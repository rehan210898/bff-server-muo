const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { asyncHandler } = require('../middleware/errorHandler');
const tokenStore = require('../services/tokenStore');
const logger = require('../utils/logger');

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// WooCommerce status → notification message
const STATUS_MESSAGES = {
  'processing':     { title: 'Order Confirmed!', body: 'Your order #{id} is being processed.' },
  'on-hold':        { title: 'Order On Hold', body: 'Your order #{id} has been placed on hold.' },
  'completed':      { title: 'Order Delivered!', body: 'Your order #{id} has been delivered. Enjoy!' },
  'cancelled':      { title: 'Order Cancelled', body: 'Your order #{id} has been cancelled.' },
  'refunded':       { title: 'Order Refunded', body: 'Your order #{id} has been refunded.' },
  'failed':         { title: 'Order Failed', body: 'Your order #{id} payment has failed.' },
  'shipped':        { title: 'Order Shipped!', body: 'Your order #{id} has been shipped!' },
  'out-for-delivery': { title: 'Out for Delivery!', body: 'Your order #{id} is out for delivery!' },
  'ready-to-ship':  { title: 'Ready to Ship', body: 'Your order #{id} is packed and ready to ship.' },
};

/**
 * Send push notification to order customer
 */
async function notifyCustomer(customerId, orderId, status) {
  if (!customerId) {
    logger.info(`Guest order #${orderId}, no user to notify`);
    return;
  }

  const tokens = tokenStore.getUserTokens(customerId);
  if (tokens.length === 0) {
    logger.info(`No push tokens for user ${customerId}, skipping notification`);
    return;
  }

  const template = STATUS_MESSAGES[status];
  if (!template) {
    logger.info(`No notification template for status "${status}", skipping`);
    return;
  }

  const title = template.title;
  const body = template.body.replace('#{id}', orderId);

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: {
      type: 'ORDER_UPDATE',
      screen: 'OrderTracking',
      params: { orderId: Number(orderId) },
    },
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // Clean up invalid tokens
    if (response.data && response.data.data) {
      const invalidTokens = [];
      response.data.data.forEach((ticket, idx) => {
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          invalidTokens.push(messages[idx].to);
        }
      });
      if (invalidTokens.length > 0) tokenStore.deleteTokens(invalidTokens);
    }

    logger.info(`Order notification sent to user ${customerId} for order #${orderId} (${status})`);
  } catch (err) {
    logger.error(`Failed to send notification for order #${orderId}:`, err.message);
  }
}

/**
 * Verify WooCommerce webhook signature
 */
function verifyWooCommerceSignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');
  return hash === signature;
}

// GET — WooCommerce pings this URL to verify it exists when saving the webhook
router.get('/order-updated', (req, res) => {
  res.json({ success: true, message: 'WooCommerce webhook endpoint active' });
});

// ──────────────────────────────────────────────────────────────
// POST /api/v1/woowebhook/order-updated
// Receives WooCommerce webhook for order status changes
//
// WooCommerce Webhook Settings:
//   Name:         Order Status Notifications
//   Status:       Active
//   Topic:        Order updated
//   Delivery URL: https://your-server.com/api/v1/woowebhook/order-updated
//   Secret:       (your secret - set in .env as WC_WEBHOOK_SECRET)
//   API Version:  WP REST API v3
// ──────────────────────────────────────────────────────────────
router.post('/order-updated', asyncHandler(async (req, res) => {
  // WooCommerce sends a ping on webhook creation — respond 200
  const wcTopic = req.headers['x-wc-webhook-topic'];
  const wcEvent = req.headers['x-wc-webhook-event'];

  if (wcTopic === 'action.woocommerce_webhook_ping' || !req.body.id) {
    logger.info('WooCommerce webhook ping received');
    return res.json({ success: true, message: 'Webhook ping acknowledged' });
  }

  // Verify signature if secret is configured
  const secret = process.env.WC_WEBHOOK_SECRET;
  const signature = req.headers['x-wc-webhook-signature'];
  if (secret && signature) {
    const rawBody = JSON.stringify(req.body);
    if (!verifyWooCommerceSignature(rawBody, signature, secret)) {
      logger.warn('WooCommerce webhook: invalid signature');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }
  }

  const order = req.body;
  const orderId = order.id;
  const status = order.status;
  const customerId = order.customer_id;

  logger.info(`WooCommerce webhook: Order #${orderId} → status: ${status}, customer: ${customerId}`);

  // Send push notification to customer
  await notifyCustomer(customerId, orderId, status);

  res.json({ success: true, message: 'Webhook processed' });
}));

module.exports = router;
