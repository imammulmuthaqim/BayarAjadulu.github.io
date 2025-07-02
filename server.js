const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'BayarAja server is running' });
});

// Midtrans Snap API endpoint
app.post('/create-snap', async (req, res) => {
  try {
    const { uid, amount } = req.body;

    if (!uid || !amount) {
      return res.status(400).json({ error: 'UID and amount are required' });
    }

    // Generate unique order ID
    const orderId = `TOPUP-${uid}-${Date.now()}`;
    
    // Midtrans Snap parameter
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(amount)
      },
      credit_card: {
        secure: true
      },
      customer_details: {
        first_name: "BayarAja User"
      },
      callbacks: {
        finish: `${req.protocol}://${req.get('host')}/payment-success.html`
      }
    };

    // For demo purposes, return a mock token
    // In production, you would call Midtrans API here
    const mockToken = `demo-token-${Date.now()}`;
    
    console.log(`Created mock Snap token for order ${orderId}: ${mockToken}`);
    
    res.json({ 
      token: mockToken,
      orderId: orderId
    });

  } catch (error) {
    console.error('Error creating Snap token:', error);
    res.status(500).json({ error: 'Failed to create payment token' });
  }
});

// Midtrans webhook callback (demo version)
app.post('/midtrans-callback', async (req, res) => {
  try {
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = req.body;
    
    console.log('Received Midtrans callback:', {
      order_id,
      transaction_status,
      gross_amount
    });

    // In production, validate signature here
    // For demo, we'll just log and respond OK
    
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      console.log(`Payment successful for order ${order_id}: Rp ${parseInt(gross_amount).toLocaleString('id-ID')}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Midtrans callback:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Helper function to create Snap token (demo version)
async function createSnapToken(parameter) {
  // In production, this would call Midtrans API
  // For demo, return a mock token
  return `demo-token-${Date.now()}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 BayarAja server running on port ${PORT}`);
  console.log(`📱 Frontend available at http://localhost:${PORT}`);
  console.log(`💡 This is a demo version - Firebase Admin and Midtrans are mocked`);
});
