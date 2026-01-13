const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    per_page = 100,
    parent = '',
    hide_empty = true,
    orderby = 'name',
    order = 'asc',
    slug = ''
  } = req.query;

  const params = {
    page: parseInt(page),
    per_page: parseInt(per_page),
    hide_empty: hide_empty === 'true',
    orderby,
    order
  };

  if (parent) params.parent = parseInt(parent);
  if (slug) params.slug = slug;

  const categories = await wooCommerceClient.get('/products/categories', params);
  
  res.json({
    success: true,
    data: categories,
    count: categories.length
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await wooCommerceClient.get(`/products/categories/${id}`);
  
  res.json({
    success: true,
    data: category
  });
}));

module.exports = router;