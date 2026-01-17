const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

// Initialize Razorpay
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  console.warn('⚠️ Razorpay keys missing. Payment routes will fail.');
}

router.post('/razorpay-order', asyncHandler(async (req, res) => {
  if (!razorpay) {
    throw new ValidationError('Payment service unavailable (Configuration missing)');
  }
  const { order_id } = req.body;
  
  if (!order_id) {
    throw new ValidationError('Order ID is required');
  }

  // 1. Fetch Order from WC
  // We use the client directly. Ensure error handling catches 404s.
  let order;
  try {
    order = await wooCommerceClient.get(`/orders/${order_id}`, {}, { useCache: false });
  } catch (error) {
    throw new ValidationError('Order not found or WC error');
  }

  const amount = parseFloat(order.total);
  const currency = order.currency || 'INR';

  const options = {
    amount: Math.round(amount * 100),
    currency: currency,
    receipt: `order_${order_id}`
  };

  try {
    const rzOrder = await razorpay.orders.create(options);
    
    // Return format expected by mobile app
    res.json({
      razorpay_order_id: rzOrder.id,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: rzOrder.amount,
      currency: rzOrder.currency,
      name: 'Makeup Ocean',
      description: `Order #${order_id}`,
      prefill: {
        name: `${order.billing.first_name} ${order.billing.last_name}`,
        email: order.billing.email,
        contact: order.billing.phone
      }
    });

  } catch (error) {
    console.error('Razorpay Error:', error);
    const msg = error.error ? error.error.description : (error.message || 'Payment creation failed');
    throw new ValidationError(msg);
  }
}));

module.exports = router;