const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/v1/tags
 * @desc    Get all product tags
 * @access  Protected
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    per_page = 100,
    search = '',
    orderby = 'name',
    order = 'asc',
    hide_empty = false
  } = req.query;

  const params = {
    page: parseInt(page),
    per_page: parseInt(per_page),
    orderby,
    order,
    hide_empty: hide_empty === 'true'
  };

  if (search) params.search = search;

  const tags = await wooCommerceClient.get('/products/tags', params);
  
  res.json({
    success: true,
    data: tags,
    count: tags.length
  });
}));

/**
 * @route   GET /api/v1/tags/:id
 * @desc    Get single tag by ID
 * @access  Protected
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tag = await wooCommerceClient.get(`/products/tags/${id}`);
  
  res.json({
    success: true,
    data: tag
  });
}));

module.exports = router;
