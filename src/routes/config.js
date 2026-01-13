const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/', asyncHandler(async (req, res) => {
  try {
    // Fetch config from WordPress custom endpoint
    // Namespace 'muo/v1' must match what's in functions.php
    const config = await wooCommerceClient.get('/config', {}, { 
        namespace: 'muo/v1', 
        useCache: false 
    });
    
    res.json(config);
  } catch (error) {
    // Fallback if WP endpoint doesn't exist yet
    res.json({
        cod_fee: 20,
        shipping_cost: 79,
        free_shipping_threshold: 500
    });
  }
}));

module.exports = router;