const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/v1/attributes
 * @desc    Get all product attributes
 * @access  Protected
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    per_page = 100,
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

  const attributes = await wooCommerceClient.get('/products/attributes', params);
  
  res.json({
    success: true,
    data: attributes,
    count: attributes.length
  });
}));

/**
 * @route   GET /api/v1/attributes/:id
 * @desc    Get single attribute by ID
 * @access  Protected
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const attribute = await wooCommerceClient.get(`/products/attributes/${id}`);
  
  res.json({
    success: true,
    data: attribute
  });
}));

/**
 * @route   GET /api/v1/attributes/:id/terms
 * @desc    Get terms for an attribute
 * @access  Protected
 */
router.get('/:id/terms', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    per_page = 100,
    orderby = 'name',
    order = 'asc',
    hide_empty = false,
    search = ''
  } = req.query;

  const params = {
    page: parseInt(page),
    per_page: parseInt(per_page),
    orderby,
    order,
    hide_empty: hide_empty === 'true'
  };

  if (search) params.search = search;

  const terms = await wooCommerceClient.get(`/products/attributes/${id}/terms`, params);
  
  res.json({
    success: true,
    data: terms,
    count: terms.length
  });
}));

module.exports = router;
