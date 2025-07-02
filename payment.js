// Payment integration with Midtrans
class PaymentManager {
  constructor() {
    this.snapLoaded = false;
    this.loadMidtransSnap();
  }

  // Load Midtrans Snap script
  loadMidtransSnap() {
    if (this.snapLoaded) return;

    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', 'SB-Mid-client-your_client_key'); // Replace with actual client key
    script.onload = () => {
      this.snapLoaded = true;
      console.log('Midtrans Snap loaded successfully');
    };
    document.head.appendChild(script);
  }

  // Create top-up payment
  async createTopUpPayment(amount) {
    try {
      const user = firebase.auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call backend to create Snap token
      const response = await fetch('/create-snap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          amount: amount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment token');
      }

      const data = await response.json();
      return data.token;

    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  // Process payment with Snap
  async processPayment(snapToken) {
    return new Promise((resolve, reject) => {
      if (!window.snap) {
        reject(new Error('Midtrans Snap not loaded'));
        return;
      }

      window.snap.pay(snapToken, {
        onSuccess: (result) => {
          Utils.showToast('Pembayaran berhasil!', 'success');
          resolve(result);
        },
        onPending: (result) => {
          Utils.showToast('Pembayaran sedang diproses...', 'info');
          resolve(result);
        },
        onError: (result) => {
          Utils.showToast('Pembayaran gagal!', 'error');
          reject(result);
        },
        onClose: () => {
          Utils.showToast('Pembayaran dibatalkan', 'warning');
          reject(new Error('Payment cancelled'));
        }
      });
    });
  }

  // Top up balance
  async topUpBalance(amount) {
    try {
      Utils.showToast('Memproses pembayaran...', 'info');
      
      const snapToken = await this.createTopUpPayment(amount);
      const result = await this.processPayment(snapToken);
      
      return result;
    } catch (error) {
      console.error('Top-up error:', error);
      throw error;
    }
  }
}

// Initialize payment manager globally
window.paymentManager = new PaymentManager();