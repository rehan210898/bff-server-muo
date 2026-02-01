const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler, ValidationError, UnauthorizedError } = require('../middleware/errorHandler');
const { validationRules } = require('../middleware/validate');
const logger = require('../utils/logger');

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

/**
 * Create a Razorpay order for a WooCommerce order
 * POST /payment/razorpay-order
 */
router.post('/razorpay-order', validationRules.razorpayOrder, asyncHandler(async (req, res) => {
  if (!razorpay) {
    throw new ValidationError('Payment service unavailable (Configuration missing)');
  }
  const { order_id } = req.body;

  // 1. Fetch Order from WC
  let order;
  try {
    order = await wooCommerceClient.get(`/orders/${order_id}`, {}, { useCache: false });
  } catch (error) {
    throw new ValidationError('Order not found or WC error');
  }

  // Validate order status - only allow pending/failed orders
  if (!['pending', 'failed'].includes(order.status)) {
    throw new ValidationError(`Cannot process payment for order with status: ${order.status}`);
  }

  const amount = parseFloat(order.total);
  const currency = order.currency || 'INR';

  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: currency,
    receipt: `order_${order_id}`,
    notes: {
      wc_order_id: order_id.toString(),
      customer_email: order.billing.email
    }
  };

  try {
    const rzOrder = await razorpay.orders.create(options);

    logger.info('Razorpay order created', {
      razorpay_order_id: rzOrder.id,
      wc_order_id: order_id,
      amount: rzOrder.amount
    });

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
    logger.error('Razorpay order creation failed', { error: error.message, order_id });
    const msg = error.error ? error.error.description : (error.message || 'Payment creation failed');
    throw new ValidationError(msg);
  }
}));

/**
 * Verify Razorpay payment signature and update WC order
 * POST /payment/verify
 *
 * CRITICAL: This endpoint must be called after successful payment on mobile app
 */
router.post('/verify', validationRules.paymentVerify, asyncHandler(async (req, res) => {
  if (!razorpay) {
    throw new ValidationError('Payment service unavailable');
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    wc_order_id
  } = req.body;

  // Generate expected signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  // Verify signature
  const isValidSignature = expectedSignature === razorpay_signature;

  if (!isValidSignature) {
    logger.warn('Invalid payment signature', {
      razorpay_order_id,
      razorpay_payment_id,
      wc_order_id
    });
    throw new UnauthorizedError('Payment verification failed: Invalid signature');
  }

  logger.info('Payment signature verified', {
    razorpay_order_id,
    razorpay_payment_id,
    wc_order_id
  });

  // Fetch payment details from Razorpay to confirm status
  let payment;
  try {
    payment = await razorpay.payments.fetch(razorpay_payment_id);
  } catch (error) {
    logger.error('Failed to fetch payment details', { error: error.message });
    throw new ValidationError('Could not verify payment status');
  }

  if (payment.status !== 'captured') {
    // If payment is authorized but not captured, capture it
    if (payment.status === 'authorized') {
      try {
        payment = await razorpay.payments.capture(razorpay_payment_id, payment.amount, payment.currency);
        logger.info('Payment captured', { razorpay_payment_id, amount: payment.amount });
      } catch (captureError) {
        logger.error('Failed to capture payment', { error: captureError.message });
        throw new ValidationError('Payment capture failed');
      }
    } else {
      throw new ValidationError(`Payment not successful. Status: ${payment.status}`);
    }
  }

  // Update WooCommerce order status to processing
  try {
    await wooCommerceClient.put(`/orders/${wc_order_id}`, {
      status: 'processing',
      payment_method: 'razorpay',
      payment_method_title: 'Razorpay',
      transaction_id: razorpay_payment_id,
      set_paid: true,
      meta_data: [
        { key: '_razorpay_order_id', value: razorpay_order_id },
        { key: '_razorpay_payment_id', value: razorpay_payment_id },
        { key: '_payment_verified_at', value: new Date().toISOString() }
      ]
    });

    logger.info('WooCommerce order updated', {
      wc_order_id,
      status: 'processing',
      transaction_id: razorpay_payment_id
    });

  } catch (wcError) {
    logger.error('Failed to update WC order after payment', {
      error: wcError.message,
      wc_order_id
    });
    // Payment was successful but order update failed
    // Log for manual reconciliation but return success to user
  }

  res.json({
    success: true,
    message: 'Payment verified successfully',
    order_id: wc_order_id,
    payment_id: razorpay_payment_id,
    status: 'processing'
  });
}));

/**
 * Razorpay Webhook Handler
 * POST /payment/webhook
 *
 * This endpoint receives payment events from Razorpay
 * Configure webhook URL in Razorpay Dashboard: https://yourapi.com/api/v1/payment/webhook
 */
router.post('/webhook', asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // If webhook secret is not configured, log warning but accept
  if (webhookSecret) {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      logger.warn('Webhook received without signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Verify webhook signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  const event = req.body.event;
  const payload = req.body.payload;

  logger.info('Razorpay webhook received', { event });

  switch (event) {
    case 'payment.captured':
      await handlePaymentCaptured(payload.payment.entity);
      break;

    case 'payment.failed':
      await handlePaymentFailed(payload.payment.entity);
      break;

    case 'refund.created':
      await handleRefundCreated(payload.refund.entity);
      break;

    case 'order.paid':
      // Order fully paid - backup handler
      logger.info('Order paid event', { order_id: payload.order.entity.id });
      break;

    default:
      logger.info('Unhandled webhook event', { event });
  }

  // Always respond 200 to acknowledge receipt
  res.json({ status: 'ok' });
}));

/**
 * Handle successful payment capture from webhook
 */
async function handlePaymentCaptured(payment) {
  const wcOrderId = payment.notes?.wc_order_id;

  if (!wcOrderId) {
    logger.warn('Payment captured but no WC order ID in notes', {
      payment_id: payment.id
    });
    return;
  }

  try {
    // Check current order status
    const order = await wooCommerceClient.get(`/orders/${wcOrderId}`, {}, { useCache: false });

    // Only update if not already processed
    if (['pending', 'failed', 'on-hold'].includes(order.status)) {
      await wooCommerceClient.put(`/orders/${wcOrderId}`, {
        status: 'processing',
        set_paid: true,
        transaction_id: payment.id,
        meta_data: [
          { key: '_razorpay_payment_id', value: payment.id },
          { key: '_webhook_processed_at', value: new Date().toISOString() }
        ]
      });

      logger.info('Order updated via webhook', {
        wc_order_id: wcOrderId,
        payment_id: payment.id
      });
    }
  } catch (error) {
    logger.error('Failed to process payment.captured webhook', {
      error: error.message,
      wc_order_id: wcOrderId
    });
  }
}

/**
 * Handle failed payment from webhook
 */
async function handlePaymentFailed(payment) {
  const wcOrderId = payment.notes?.wc_order_id;

  if (!wcOrderId) {
    return;
  }

  try {
    await wooCommerceClient.put(`/orders/${wcOrderId}`, {
      status: 'failed',
      meta_data: [
        { key: '_payment_failure_reason', value: payment.error_description || 'Payment failed' },
        { key: '_razorpay_payment_id', value: payment.id }
      ]
    });

    logger.info('Order marked as failed via webhook', {
      wc_order_id: wcOrderId,
      reason: payment.error_description
    });
  } catch (error) {
    logger.error('Failed to process payment.failed webhook', { error: error.message });
  }
}

/**
 * Handle refund created from webhook
 */
async function handleRefundCreated(refund) {
  logger.info('Refund created', {
    refund_id: refund.id,
    payment_id: refund.payment_id,
    amount: refund.amount / 100 // Convert from paise
  });

  // Note: WooCommerce refund should already be created if initiated from WC
  // This is for refunds initiated directly from Razorpay Dashboard
}

/**
 * Initiate refund for an order
 * POST /payment/refund
 */
router.post('/refund', validationRules.refund, asyncHandler(async (req, res) => {
  if (!razorpay) {
    throw new ValidationError('Payment service unavailable');
  }

  const { wc_order_id, amount, reason } = req.body;

  // Fetch order to get payment ID
  let order;
  try {
    order = await wooCommerceClient.get(`/orders/${wc_order_id}`, {}, { useCache: false });
  } catch (error) {
    throw new ValidationError('Order not found');
  }

  const paymentId = order.transaction_id;
  if (!paymentId) {
    throw new ValidationError('No payment found for this order');
  }

  // Calculate refund amount (full or partial)
  const refundAmount = amount ? Math.round(parseFloat(amount) * 100) : null;

  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: refundAmount, // If null, full refund
      notes: {
        wc_order_id: wc_order_id.toString(),
        reason: reason || 'Customer requested refund'
      }
    });

    logger.info('Refund initiated', {
      refund_id: refund.id,
      payment_id: paymentId,
      amount: refund.amount / 100
    });

    res.json({
      success: true,
      refund_id: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    });

  } catch (error) {
    logger.error('Refund failed', { error: error.message, wc_order_id });
    const msg = error.error ? error.error.description : (error.message || 'Refund failed');
    throw new ValidationError(msg);
  }
}));

/**
 * Get payment status for an order
 * GET /payment/status/:order_id
 */
router.get('/status/:order_id', asyncHandler(async (req, res) => {
  const { order_id } = req.params;

  // Fetch order
  let order;
  try {
    order = await wooCommerceClient.get(`/orders/${order_id}`, {}, { useCache: false });
  } catch (error) {
    throw new ValidationError('Order not found');
  }

  const paymentId = order.transaction_id;
  let paymentDetails = null;

  if (paymentId && razorpay) {
    try {
      paymentDetails = await razorpay.payments.fetch(paymentId);
    } catch (error) {
      logger.warn('Could not fetch payment details', { payment_id: paymentId });
    }
  }

  res.json({
    order_id: order_id,
    order_status: order.status,
    payment_method: order.payment_method,
    transaction_id: paymentId,
    payment_status: paymentDetails?.status || null,
    amount_paid: paymentDetails ? paymentDetails.amount / 100 : null,
    is_paid: order.date_paid !== null
  });
}));

module.exports = router;
