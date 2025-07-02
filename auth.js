// Authentication logic and auth guard
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
  }

  // Initialize auth state listener
  init() {
    return new Promise((resolve) => {
      firebase.onAuthStateChanged(firebase.auth, (user) => {
        this.currentUser = user;
        this.authStateListeners.forEach(callback => callback(user));
        resolve(user);
      });
    });
  }

  // Add auth state listener
  onAuthStateChanged(callback) {
    this.authStateListeners.push(callback);
  }

  // Register new user
  async register(email, password, fullName, phoneNumber) {
    try {
      // Validate password strength
      if (!this.isPasswordStrong(password)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and number');
      }

      // Create user account
      const userCredential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
      const user = userCredential.user;

      // Create user document
      await firebase.setDoc(firebase.doc(firebase.db, 'users', user.uid), {
        name: fullName,
        email: email,
        phone: phoneNumber,
        createdAt: firebase.serverTimestamp()
      });

      // Create wallet document
      await firebase.setDoc(firebase.doc(firebase.db, 'wallets', user.uid), {
        balance: 0,
        createdAt: firebase.serverTimestamp()
      });

      return user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // Login with email and password
  async login(email, password) {
    try {
      const userCredential = await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // Login with Google
  async loginWithGoogle() {
    try {
      const result = await firebase.signInWithPopup(firebase.auth, firebase.googleProvider);
      const user = result.user;

      // Check if user document exists, create if not
      const userDoc = await firebase.getDoc(firebase.doc(firebase.db, 'users', user.uid));
      if (!userDoc.exists()) {
        await firebase.setDoc(firebase.doc(firebase.db, 'users', user.uid), {
          name: user.displayName,
          email: user.email,
          phone: user.phoneNumber || '',
          createdAt: firebase.serverTimestamp()
        });

        await firebase.setDoc(firebase.doc(firebase.db, 'wallets', user.uid), {
          balance: 0,
          createdAt: firebase.serverTimestamp()
        });
      }

      return user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // Login with phone number
  async loginWithPhone(phoneNumber, appVerifier) {
    try {
      const confirmationResult = await firebase.signInWithPhoneNumber(firebase.auth, phoneNumber, appVerifier);
      return confirmationResult;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // Logout
  async logout() {
    try {
      await firebase.signOut(firebase.auth);
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Auth guard - protect pages
  requireAuth() {
    return new Promise((resolve, reject) => {
      const unsubscribe = firebase.onAuthStateChanged(firebase.auth, (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          window.location.href = 'login.html';
          reject(new Error('Authentication required'));
        }
      });
    });
  }

  // Check if user is authenticated (for splash screen)
  isAuthenticated() {
    return new Promise((resolve) => {
      const unsubscribe = firebase.onAuthStateChanged(firebase.auth, (user) => {
        unsubscribe();
        resolve(!!user);
      });
    });
  }

  // Password strength validation
  isPasswordStrong(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;
  }

  // Get password strength score
  getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    return score;
  }

  // Handle authentication errors
  handleAuthError(error) {
    const errorMessages = {
      'auth/user-not-found': 'Pengguna tidak ditemukan',
      'auth/wrong-password': 'Password salah',
      'auth/email-already-in-use': 'Email sudah digunakan',
      'auth/weak-password': 'Password terlalu lemah',
      'auth/invalid-email': 'Format email tidak valid',
      'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti',
      'auth/network-request-failed': 'Koneksi internet bermasalah'
    };

    return new Error(errorMessages[error.code] || error.message);
  }
}

// Initialize auth manager
window.authManager = new AuthManager();