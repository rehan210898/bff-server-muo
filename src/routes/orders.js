
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { transformOrder, transformOrders } = require('../transformers/orderTransformer');

router.post('/', asyncHandler(async (req, res) => {
  const orderData = req.body;
  const authHeader = req.headers.authorization;
  
  // Security: Handle User Association
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // If user is logged in, force the customer_id to match their token
      // This prevents User A from placing an order for User B
      if (orderData.customer_id && parseInt(orderData.customer_id) !== decoded.id) {
        throw new ValidationError('Invalid customer_id for authenticated user');
      }
      
      // Auto-assign customer_id if not present
      orderData.customer_id = decoded.id;
      
    } catch (err) {
      // Soft Fail: If token is invalid (expired/wrong secret), treat as Guest
      // This prevents blocking the order if the app has a stale token
      console.warn('⚠️ Invalid token received for order placement. Proceeding as Guest.');
      if (orderData.customer_id) {
          delete orderData.customer_id;
      }
      // Do NOT throw. Fall through to guest logic.
    }
  } else {
    // Guest Checkout
    // Security: Prevent guests from assigning orders to existing users ID spoofing
    if (orderData.customer_id) {
      delete orderData.customer_id; 
      // Or throw error: throw new ValidationError('Guests cannot assign customer_id');
      // Deleting is safer/smoother for potential frontend bugs
    }
  }
  
  if (!orderData.line_items || orderData.line_items.length === 0) {
    throw new ValidationError('Order must contain at least one item');
  }
  
  if (!orderData.billing) {
    throw new ValidationError('Billing information is required');
  }
  
  const order = await wooCommerceClient.post('/orders', orderData);
  
  res.status(201).json({
    success: true,
    data: transformOrder(order),
    message: 'Order created successfully'
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    per_page = 10,
    customer = '',
    status = '',
    orderby = 'date',
    order = 'desc'
  } = req.query;

  const params = {
    page: parseInt(page),
    per_page: parseInt(per_page),
    orderby,
    order
  };

  if (status) params.status = status;

  let unifiedOrders = [];

  // Unified History Logic: Try to match by ID AND Email if authenticated
  const authHeader = req.headers.authorization;
  let fetchedUnified = false;

  if (customer && authHeader && authHeader.startsWith('Bearer ')) {
      try {
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Only apply unified logic if the requested customer matches the token
          if (parseInt(customer) === decoded.id && decoded.email) {
              console.log(`🔍 Unified History for User ${decoded.id} (${decoded.email})`);
              fetchedUnified = true;

              // 1. Fetch by ID
              const p1 = wooCommerceClient.get('/orders', { ...params, customer: parseInt(customer) }, { useCache: false });
              
              // 2. Fetch by Email (Guest Orders)
              // We reset page to 1 for email search to ensure we catch recent guest orders 
              // (merging pagination is complex, this prioritizes recent visibility)
              const p2 = wooCommerceClient.get('/orders', { 
                  ...params, 
                  customer: undefined, // Clear customer filter
                  search: decoded.email 
              }, { useCache: false });

              const [ordersById, ordersByEmail] = await Promise.all([p1, p2]);
              
              // Merge & Deduplicate
              const allOrders = [...ordersById];
              const idSet = new Set(ordersById.map(o => o.id));
              
              if (Array.isArray(ordersByEmail)) {
                  ordersByEmail.forEach(o => {
                      // Strict Email Check (API search is fuzzy)
                      // Only add if not already present AND email matches exactly
                      if (!idSet.has(o.id) && o.billing?.email?.toLowerCase() === decoded.email.toLowerCase()) {
                          allOrders.push(o);
                      }
                  });
              }

              // Sort (descending date)
              unifiedOrders = allOrders.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
              
              // Slice to requested limit (simplified pagination)
              if (unifiedOrders.length > parseInt(per_page)) {
                  unifiedOrders = unifiedOrders.slice(0, parseInt(per_page));
              }
          }
      } catch (e) {
          console.warn('Unified history fetch failed (token invalid?), falling back to standard.', e.message);
      }
  }

  if (!fetchedUnified) {
      if (customer) params.customer = parseInt(customer);
      console.log('Fetching orders with params:', params);
      unifiedOrders = await wooCommerceClient.get('/orders', params, { useCache: false });
  }

  console.log(`Found ${unifiedOrders.length} orders`);
  
  res.json({
    success: true,
    data: transformOrders(unifiedOrders),
    pagination: {
      page: parseInt(page),
      per_page: parseInt(per_page),
      total: unifiedOrders.length // Note: Total count might be inaccurate for unified history without complex counting
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await wooCommerceClient.get(`/orders/${id}`, {}, { useCache: false });
  
  res.json({
    success: true,
    data: transformOrder(order)
  });
}));

router.post('/:id/refunds', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const refundData = req.body;

  if (!refundData.amount) {
    throw new ValidationError('Refund amount is required');
  }

  const refund = await wooCommerceClient.post(`/orders/${id}/refunds`, refundData);

  res.status(201).json({
    success: true,
    data: refund,
    message: 'Refund created successfully'
  });
}));

module.exports = router;