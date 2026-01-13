const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

router.post('/razorpay-order', asyncHandler(async (req, res) => {
  const data = req.body;
  
  // Call WooCommerce custom endpoint
  const result = await wooCommerceClient.post('/razorpay-order', data, {}, { namespace: 'custom/v1' });
  
  res.json(result);
}));

module.exports = router;