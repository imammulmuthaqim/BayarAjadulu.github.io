const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

// Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

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

    // Create Snap token
    const snapToken = await createSnapToken(parameter);
    
    res.json({ 
      token: snapToken,
      orderId: orderId
    });

  } catch (error) {
    console.error('Error creating Snap token:', error);
    res.status(500).json({ error: 'Failed to create payment token' });
  }
});

// Midtrans webhook callback
app.post('/midtrans-callback', async (req, res) => {
  try {
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = req.body;
    
    // Validate signature
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
      .digest('hex');

    if (expectedSignature !== signature_key) {
      console.error('Invalid signature from Midtrans');
      return res.status(403).send('Forbidden: Invalid signature');
    }

    // Process successful payment
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // Extract UID from order_id
      const uidMatch = order_id.match(/TOPUP-(.+)-\d+/);
      if (!uidMatch) {
        return res.status(400).send('Invalid order ID format');
      }
      
      const uid = uidMatch[1];
      const amount = parseInt(gross_amount);

      // Update user balance using Firestore transaction
      await db.runTransaction(async (transaction) => {
        const walletRef = db.collection('wallets').doc(uid);
        const walletDoc = await transaction.get(walletRef);
        
        const currentBalance = walletDoc.exists ? walletDoc.data().balance || 0 : 0;
        const newBalance = currentBalance + amount;
        
        // Update wallet balance
        transaction.set(walletRef, { 
          balance: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Log transaction
        const transactionRef = db.collection('transactions').doc();
        transaction.set(transactionRef, {
          uid: uid,
          type: 'TOP_UP',
          amount: amount,
          orderId: order_id,
          status: 'SUCCESS',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          description: `Top up via QRIS - ${order_id}`
        });
      });

      console.log(`Successfully processed top-up for user ${uid}: Rp ${amount.toLocaleString('id-ID')}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Midtrans callback:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Helper function to create Snap token
async function createSnapToken(parameter) {
  const fetch = (await import('node-fetch')).default;
  
  const auth = Buffer.from(process.env.MIDTRANS_SERVER_KEY + ':').toString('base64');
  const url = process.env.MIDTRANS_IS_PRODUCTION === 'true' 
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(parameter)
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Midtrans API error: ${result.error_messages?.join(', ') || 'Unknown error'}`);
  }

  return result.token;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 BayarAja server running on port ${PORT}`);
  console.log(`📱 Frontend available at http://localhost:${PORT}`);
});