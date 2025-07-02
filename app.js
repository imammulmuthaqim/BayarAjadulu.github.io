// Main application logic
class BayarAjaApp {
  constructor() {
    this.currentUser = null;
    this.userWallet = null;
    this.walletListener = null;
  }

  // Initialize app
  async init() {
    try {
      // Wait for auth state
      this.currentUser = await authManager.init();
      
      if (this.currentUser) {
        await this.loadUserData();
        this.setupWalletListener();
      }
    } catch (error) {
      console.error('App initialization error:', error);
    }
  }

  // Load user data from Firestore
  async loadUserData() {
    try {
      const userDoc = await firebase.getDoc(firebase.doc(firebase.db, 'users', this.currentUser.uid));
      if (userDoc.exists()) {
        this.userData = userDoc.data();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Setup real-time wallet balance listener
  setupWalletListener() {
    if (this.walletListener) {
      this.walletListener(); // Unsubscribe previous listener
    }

    const walletRef = firebase.doc(firebase.db, 'wallets', this.currentUser.uid);
    this.walletListener = firebase.onSnapshot(walletRef, (doc) => {
      if (doc.exists()) {
        this.userWallet = doc.data();
        this.updateBalanceDisplay();
      }
    });
  }

  // Update balance display on UI
  updateBalanceDisplay() {
    const balanceElements = document.querySelectorAll('.balance-amount');
    balanceElements.forEach(element => {
      element.textContent = Utils.formatCurrency(this.userWallet?.balance || 0);
    });
  }

  // Transfer money between users
  async transferMoney(recipientUid, amount, note = '') {
    try {
      const numAmount = Utils.validateAmount(amount);
      
      // Check sufficient balance
      if (!this.userWallet || this.userWallet.balance < numAmount) {
        throw new Error('Saldo tidak mencukupi');
      }

      // Get recipient data
      const recipientDoc = await firebase.getDoc(firebase.doc(firebase.db, 'users', recipientUid));
      if (!recipientDoc.exists()) {
        throw new Error('Penerima tidak ditemukan');
      }

      const recipientData = recipientDoc.data();
      const transactionId = Utils.generateTransactionId();

      // Execute transfer using Firestore transaction
      await firebase.runTransaction(firebase.db, async (transaction) => {
        // Get current balances
        const senderWalletRef = firebase.doc(firebase.db, 'wallets', this.currentUser.uid);
        const recipientWalletRef = firebase.doc(firebase.db, 'wallets', recipientUid);
        
        const senderWalletDoc = await transaction.get(senderWalletRef);
        const recipientWalletDoc = await transaction.get(recipientWalletRef);

        const senderBalance = senderWalletDoc.exists() ? senderWalletDoc.data().balance : 0;
        const recipientBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;

        // Validate sender balance again
        if (senderBalance < numAmount) {
          throw new Error('Saldo tidak mencukupi');
        }

        // Update balances
        transaction.update(senderWalletRef, {
          balance: senderBalance - numAmount,
          updatedAt: firebase.serverTimestamp()
        });

        transaction.set(recipientWalletRef, {
          balance: recipientBalance + numAmount,
          updatedAt: firebase.serverTimestamp()
        }, { merge: true });

        // Log sender transaction
        const senderTransactionRef = firebase.doc(firebase.collection(firebase.db, 'transactions'), transactionId + '-OUT');
        transaction.set(senderTransactionRef, {
          uid: this.currentUser.uid,
          type: 'TRANSFER_OUT',
          amount: numAmount,
          recipientUid: recipientUid,
          recipientName: recipientData.name,
          transactionId: transactionId,
          note: note,
          status: 'SUCCESS',
          createdAt: firebase.serverTimestamp()
        });

        // Log recipient transaction
        const recipientTransactionRef = firebase.doc(firebase.collection(firebase.db, 'transactions'), transactionId + '-IN');
        transaction.set(recipientTransactionRef, {
          uid: recipientUid,
          type: 'TRANSFER_IN',
          amount: numAmount,
          senderUid: this.currentUser.uid,
          senderName: this.userData.name,
          transactionId: transactionId,
          note: note,
          status: 'SUCCESS',
          createdAt: firebase.serverTimestamp()
        });
      });

      Utils.showToast(`Transfer berhasil ke ${recipientData.name}`, 'success');
      return { success: true, recipientName: recipientData.name };

    } catch (error) {
      Utils.showToast(error.message, 'error');
      throw error;
    }
  }

  // Get user transactions
  async getTransactions(limit = 50) {
    try {
      const q = firebase.query(
        firebase.collection(firebase.db, 'transactions'),
        firebase.where('uid', '==', this.currentUser.uid),
        firebase.orderBy('createdAt', 'desc')
      );

      return new Promise((resolve, reject) => {
        firebase.onSnapshot(q, (querySnapshot) => {
          const transactions = [];
          querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
          });
          resolve(transactions);
        }, reject);
      });
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  // Find user by email or UID
  async findUser(identifier) {
    try {
      let userDoc;
      
      // Try to find by UID first
      if (identifier.length > 20) {
        userDoc = await firebase.getDoc(firebase.doc(firebase.db, 'users', identifier));
      } else {
        // Find by email
        const q = firebase.query(
          firebase.collection(firebase.db, 'users'),
          firebase.where('email', '==', identifier)
        );
        
        const querySnapshot = await firebase.getDocs(q);
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          return { uid: doc.id, ...doc.data() };
        }
      }

      if (userDoc && userDoc.exists()) {
        return { uid: userDoc.id, ...userDoc.data() };
      }

      return null;
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  }

  // Calculate monthly expenses
  async getMonthlyExpenses() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const q = firebase.query(
        firebase.collection(firebase.db, 'transactions'),
        firebase.where('uid', '==', this.currentUser.uid),
        firebase.where('type', 'in', ['TRANSFER_OUT', 'PURCHASE', 'PAYMENT']),
        firebase.where('createdAt', '>=', startOfMonth)
      );

      const querySnapshot = await firebase.getDocs(q);
      let totalExpenses = 0;
      
      querySnapshot.forEach((doc) => {
        totalExpenses += doc.data().amount || 0;
      });

      return totalExpenses;
    } catch (error) {
      console.error('Error calculating monthly expenses:', error);
      return 0;
    }
  }

  // Purchase digital products
  async purchaseDigitalProduct(type, details, amount) {
    try {
      const numAmount = Utils.validateAmount(amount);
      
      // Check sufficient balance
      if (!this.userWallet || this.userWallet.balance < numAmount) {
        throw new Error('Saldo tidak mencukupi');
      }

      const transactionId = Utils.generateTransactionId();

      // Execute purchase using Firestore transaction
      await firebase.runTransaction(firebase.db, async (transaction) => {
        const walletRef = firebase.doc(firebase.db, 'wallets', this.currentUser.uid);
        const walletDoc = await transaction.get(walletRef);
        
        const currentBalance = walletDoc.exists() ? walletDoc.data().balance : 0;
        
        if (currentBalance < numAmount) {
          throw new Error('Saldo tidak mencukupi');
        }

        // Update balance
        transaction.update(walletRef, {
          balance: currentBalance - numAmount,
          updatedAt: firebase.serverTimestamp()
        });

        // Log transaction
        const transactionRef = firebase.doc(firebase.collection(firebase.db, 'transactions'), transactionId);
        transaction.set(transactionRef, {
          uid: this.currentUser.uid,
          type: 'PURCHASE',
          subType: type,
          amount: numAmount,
          details: details,
          transactionId: transactionId,
          status: 'SUCCESS',
          createdAt: firebase.serverTimestamp()
        });
      });

      // Generate token for electricity
      let result = { success: true, transactionId };
      if (type === 'ELECTRICITY') {
        result.token = this.generateElectricityToken();
      }

      Utils.showToast(`Pembelian ${type.toLowerCase()} berhasil`, 'success');
      return result;

    } catch (error) {
      Utils.showToast(error.message, 'error');
      throw error;
    }
  }

  // Generate random electricity token
  generateElectricityToken() {
    return Array.from({length: 20}, () => Math.floor(Math.random() * 10)).join('');
  }

  // Cleanup listeners
  cleanup() {
    if (this.walletListener) {
      this.walletListener();
    }
  }
}

// Initialize app globally
window.bayarAjaApp = new BayarAjaApp();