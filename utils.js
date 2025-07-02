// Utility functions
class Utils {
  // Format currency to Indonesian Rupiah
  static formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Format number with thousand separators
  static formatNumber(number) {
    return new Intl.NumberFormat('id-ID').format(number);
  }

  // Format date to Indonesian format
  static formatDate(date) {
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // Get greeting based on time
  static getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }

  // Show toast notification
  static showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  // Show loading spinner
  static showLoading(element) {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = '<div class="spinner"></div>';
    element.appendChild(spinner);
    return spinner;
  }

  // Hide loading spinner
  static hideLoading(spinner) {
    if (spinner && spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
  }

  // Validate email format
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate phone number (Indonesian format)
  static isValidPhone(phone) {
    const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
    return phoneRegex.test(phone);
  }

  // Generate random transaction ID
  static generateTransactionId() {
    return 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Copy text to clipboard
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Berhasil disalin ke clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy: ', err);
      this.showToast('Gagal menyalin ke clipboard', 'error');
    }
  }

  // Generate QR code data for P2P payment
  static generateQRData(recipientUid, recipientName, amount = null, isEditable = true) {
    return JSON.stringify({
      type: 'P2P_PAYMENT',
      recipientUid,
      recipientName,
      amount,
      isEditable
    });
  }

  // Parse QR code data
  static parseQRData(qrString) {
    try {
      const data = JSON.parse(qrString);
      if (data.type === 'P2P_PAYMENT') {
        return data;
      }
      throw new Error('Invalid QR code format');
    } catch (error) {
      throw new Error('QR code tidak valid');
    }
  }

  // Validate transaction amount
  static validateAmount(amount, minAmount = 1000, maxAmount = 10000000) {
    const numAmount = parseInt(amount);
    if (isNaN(numAmount) || numAmount < minAmount) {
      throw new Error(`Minimal transaksi ${this.formatCurrency(minAmount)}`);
    }
    if (numAmount > maxAmount) {
      throw new Error(`Maksimal transaksi ${this.formatCurrency(maxAmount)}`);
    }
    return numAmount;
  }
}

// Export Utils globally
window.Utils = Utils;