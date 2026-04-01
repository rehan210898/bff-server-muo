const express = require('express');
const router = express.Router();
const axios = require('axios');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { validateJWT } = require('../middleware/auth');
const shipmentStore = require('../services/shipmentStore');
const tokenStore = require('../services/tokenStore');
const wooCommerceClient = require('../services/woocommerceClient');
const logger = require('../utils/logger');

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Shiprocket status → human-readable label & WooCommerce status mapping ──

const SHIPROCKET_STATUS_MAP = {
  // Shiprocket status_id → { label, wc_status, notify }
  1:  { label: 'AWB Assigned',        wc_status: null,         notify: false },
  2:  { label: 'Label Generated',     wc_status: null,         notify: false },
  3:  { label: 'Pickup Scheduled',    wc_status: null,         notify: true,  message: 'Your order pickup has been scheduled!' },
  4:  { label: 'Pickup Queued',       wc_status: null,         notify: false },
  5:  { label: 'Manifest Generated',  wc_status: null,         notify: false },
  6:  { label: 'Shipped',             wc_status: 'shipped',    notify: true,  message: 'Your order has been shipped!' },
  7:  { label: 'Delivered',           wc_status: 'completed',  notify: true,  message: 'Your order has been delivered!' },
  8:  { label: 'Cancelled',           wc_status: 'cancelled',  notify: true,  message: 'Your shipment has been cancelled.' },
  9:  { label: 'RTO Initiated',       wc_status: null,         notify: true,  message: 'Your order is being returned to the seller.' },
  10: { label: 'RTO Delivered',       wc_status: null,         notify: true,  message: 'Your order has been returned to the seller.' },
  12: { label: 'Lost',               wc_status: null,         notify: true,  message: 'Your shipment has been reported lost. We will contact you shortly.' },
  13: { label: 'Pickup Error',       wc_status: null,         notify: false },
  14: { label: 'RTO Acknowledged',   wc_status: null,         notify: false },
  15: { label: 'Pickup Rescheduled', wc_status: null,         notify: false },
  16: { label: 'Cancellation Requested', wc_status: null,     notify: false },
  17: { label: 'Out for Delivery',   wc_status: null,         notify: true,  message: 'Your order is out for delivery!' },
  18: { label: 'In Transit',         wc_status: null,         notify: true,  message: 'Your order is in transit.' },
  19: { label: 'Out for Pickup',     wc_status: null,         notify: true,  message: 'Courier is on the way to pick up your order.' },
  20: { label: 'Pickup Exception',   wc_status: null,         notify: false },
  21: { label: 'Undelivered',        wc_status: null,         notify: true,  message: 'Delivery attempt was unsuccessful. We will retry.' },
  22: { label: 'Delayed',            wc_status: null,         notify: true,  message: 'Your delivery has been delayed. We apologize for the inconvenience.' },
  23: { label: 'Partial Delivered',   wc_status: null,         notify: true,  message: 'Part of your order has been delivered.' },
  24: { label: 'Destroyed',          wc_status: null,         notify: true,  message: 'Your shipment has been damaged/destroyed. We will contact you.' },
  25: { label: 'Disposed Off',       wc_status: null,         notify: false },
  26: { label: 'Fulfilled',          wc_status: 'completed',  notify: false },
  38: { label: 'Reached Destination Hub', wc_status: null,    notify: true,  message: 'Your order has reached the nearest delivery hub.' },
  39: { label: 'Misrouted',          wc_status: null,         notify: false },
  40: { label: 'RTO In Transit',     wc_status: null,         notify: false },
  41: { label: 'RTO Out for Delivery', wc_status: null,       notify: false },
  42: { label: 'RTO NDR',            wc_status: null,         notify: false },
  43: { label: 'Reached Back at Seller City', wc_status: null, notify: false },
};

/**
 * Send push notification to a user for shipment update
 */
async function notifyUser(userId, orderId, { title, body, data }) {
  const tokens = tokenStore.getUserTokens(userId);
  if (tokens.length === 0) {
    logger.info(`No push tokens for user ${userId}, skipping notification`);
    return;
  }

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: {
      screen: 'OrderTracking',
      params: { orderId: Number(orderId) },
      ...data,
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

    logger.info(`Shipment notification sent to user ${userId} for order #${orderId}`);
  } catch (err) {
    logger.error(`Failed to send shipment notification for order #${orderId}:`, err.message);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/shiprocket/webhook
// Receives shipment status updates from Shiprocket
// Configure this URL in Shiprocket Dashboard → Settings → Webhooks
// ──────────────────────────────────────────────────────────────
router.post('/webhook', asyncHandler(async (req, res) => {
  const payload = req.body;

  logger.info(`Shiprocket webhook received: ${JSON.stringify(payload).substring(0, 500)}`);

  // Shiprocket sends order_id as their internal ID, and the WooCommerce order ID
  // is typically in the "order_id" or "channel_order_id" field
  const orderId = payload.channel_order_id || payload.order_id;
  const statusId = payload.current_status_id || payload.shipment_status;
  const currentStatus = payload.current_status;

  if (!orderId || !statusId) {
    logger.warn('Shiprocket webhook: missing order_id or status');
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const statusInfo = SHIPROCKET_STATUS_MAP[statusId] || {
    label: currentStatus || `Status ${statusId}`,
    wc_status: null,
    notify: false,
  };

  logger.info(`Order #${orderId}: ${statusInfo.label} (status_id: ${statusId})`);

  // 1. Store detailed shipment tracking
  const shipmentData = {
    current_status: statusInfo.label,
    current_status_id: statusId,
    shipment_id: payload.shipment_id || payload.sr_shipment_id,
    awb_code: payload.awb_code || payload.awb,
    courier_name: payload.courier_name || payload.courier_company_name,
    etd: payload.etd,
    tracking_url: payload.tracking_url,
    scans: payload.scans || payload.shipment_track_activities || [],
  };

  shipmentStore.update(orderId, shipmentData);

  // 2. Update WooCommerce order status if applicable
  if (statusInfo.wc_status) {
    try {
      await wooCommerceClient.put(`/orders/${orderId}`, {
        status: statusInfo.wc_status,
      });
      logger.info(`WooCommerce order #${orderId} updated to "${statusInfo.wc_status}"`);
    } catch (err) {
      logger.error(`Failed to update WC order #${orderId}:`, err.message);
    }
  }

  // 3. Add order note in WooCommerce for tracking
  try {
    await wooCommerceClient.post(`/orders/${orderId}/notes`, {
      note: `Shiprocket: ${statusInfo.label}${shipmentData.awb_code ? ` | AWB: ${shipmentData.awb_code}` : ''}${shipmentData.courier_name ? ` | Courier: ${shipmentData.courier_name}` : ''}`,
      customer_note: false,
    });
  } catch (err) {
    logger.error(`Failed to add WC order note for #${orderId}:`, err.message);
  }

  // 4. Send push notification to the customer
  if (statusInfo.notify) {
    try {
      // Fetch order to get customer_id
      const order = await wooCommerceClient.get(`/orders/${orderId}`, {}, { useCache: false });
      if (order && order.customer_id) {
        await notifyUser(order.customer_id, orderId, {
          title: `Order #${orderId} Update`,
          body: statusInfo.message || `Your order status: ${statusInfo.label}`,
          data: { type: 'SHIPMENT_UPDATE', statusId, statusLabel: statusInfo.label },
        });
      }
    } catch (err) {
      logger.error(`Failed to notify customer for order #${orderId}:`, err.message);
    }
  }

  // Respond quickly to Shiprocket
  res.json({ success: true, message: 'Webhook processed' });
}));

// ──────────────────────────────────────────────────────────────
// GET /api/v1/shiprocket/tracking/:orderId
// Get detailed shipment tracking for an order (called by mobile app)
// ──────────────────────────────────────────────────────────────
router.get('/tracking/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const shipment = shipmentStore.getByOrderId(orderId);

  if (!shipment) {
    return res.json({
      success: true,
      data: null,
      message: 'No shipment tracking available for this order',
    });
  }

  res.json({
    success: true,
    data: {
      status: shipment.sr_status,
      status_code: shipment.sr_status_code,
      awb: shipment.awb,
      courier: shipment.courier,
      etd: shipment.etd,
      tracking_url: shipment.tracking_url,
      updated_at: shipment.updated_at,
      history: shipment.history,
    },
  });
}));

module.exports = router;
