const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');
const { transformProduct, transformProducts, transformVariations } = require('../transformers/productTransformer');

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with pagination and filters
 * @access  Protected
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    per_page = 10,
    search = '',
    category = '',
    tag = '',
    featured = '',
    on_sale = '',
    min_price = '',
    max_price = '',
    orderby = 'date',
    order = 'desc',
    status = 'publish',
    attribute = '',
    attribute_term = '',
    include = ''
  } = req.query;

  const params = {
    page: parseInt(page),
    per_page: parseInt(per_page),
    orderby,
    order,
    status
  };

  if (search) params.search = search;
  if (category) params.category = category;
  if (tag) params.tag = tag;
  if (featured) params.featured = featured === 'true';
  if (on_sale) params.on_sale = on_sale === 'true';
  if (min_price) params.min_price = min_price;
  if (max_price) params.max_price = max_price;
  if (attribute) params.attribute = attribute;
  if (attribute_term) params.attribute_term = attribute_term;
  if (include) params.include = include;

  const products = await wooCommerceClient.get('/products', params);
  
  res.json({
    success: true,
    data: transformProducts(products),
    pagination: {
      page: parseInt(page),
      per_page: parseInt(per_page),
      total: products.length
    }
  });
}));

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product by ID
 * @access  Protected
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const product = await wooCommerceClient.get(`/products/${id}`);
  
  res.json({
    success: true,
    data: transformProduct(product)
  });
}));

/**
 * @route   GET /api/v1/products/:id/variations
 * @desc    Get product variations
 * @access  Protected
 */
router.get('/:id/variations', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, per_page = 100 } = req.query;
  
  const variations = await wooCommerceClient.get(
    `/products/${id}/variations`,
    { page: parseInt(page), per_page: parseInt(per_page) }
  );
  
  res.json({
    success: true,
    data: transformVariations(variations),
    count: variations.length
  });
}));

/**
 * @route   GET /api/v1/products/slug/:slug
 * @desc    Get product by slug
 * @access  Protected
 */
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  const products = await wooCommerceClient.get('/products', { slug });
  
  if (!products || products.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
      code: 'product_not_found'
    });
  }
  
  res.json({
    success: true,
    data: transformProduct(products[0])
  });
}));

/**
 * @route   GET /api/v1/products/:id/reviews
 * @desc    Get product reviews
 * @access  Protected
 */
router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, per_page = 10 } = req.query;
  
  const reviews = await wooCommerceClient.get('/products/reviews', {
    product: [parseInt(id)],
    page: parseInt(page),
    per_page: parseInt(per_page)
  });
  
  res.json({
    success: true,
    data: reviews,
    pagination: {
      page: parseInt(page),
      per_page: parseInt(per_page),
      total: reviews.length
    }
  });
}));

/**
 * @route   POST /api/v1/products/reviews
 * @desc    Create a product review
 * @access  Protected
 */
router.post('/reviews', asyncHandler(async (req, res) => {
  const { product_id, review, reviewer, reviewer_email, rating } = req.body;

  if (!product_id || !review || !reviewer || !reviewer_email || !rating) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  const reviewData = {
    product_id,
    review,
    reviewer,
    reviewer_email,
    rating: parseInt(rating),
    verified: true
  };

  const createdReview = await wooCommerceClient.post('/products/reviews', reviewData);

  res.status(201).json({
    success: true,
    data: createdReview,
    message: 'Review submitted successfully'
  });
}));

/**
 * @route   GET /api/v1/products/featured/list
 * @desc    Get featured products
 * @access  Protected
 */
router.get('/featured/list', asyncHandler(async (req, res) => {
  const { per_page = 10 } = req.query;
  
  const products = await wooCommerceClient.get('/products', {
    featured: true,
    per_page: parseInt(per_page),
    status: 'publish'
  });
  
  res.json({
    success: true,
    data: transformProducts(products),
    count: products.length
  });
}));

/**
 * @route   GET /api/v1/products/on-sale/list
 * @desc    Get products on sale
 * @access  Protected
 */
router.get('/on-sale/list', asyncHandler(async (req, res) => {
  const { per_page = 10, page = 1 } = req.query;
  
  const products = await wooCommerceClient.get('/products', {
    on_sale: true,
    per_page: parseInt(per_page),
    page: parseInt(page),
    status: 'publish'
  });
  
  res.json({
    success: true,
    data: transformProducts(products),
    pagination: {
      page: parseInt(page),
      per_page: parseInt(per_page),
      total: products.length
    }
  });
}));

/**
 * @route   GET /api/v1/products/related/:id
 * @desc    Get related products
 * @access  Protected
 */
router.get('/related/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { per_page = 4 } = req.query;
  
  const product = await wooCommerceClient.get(`/products/${id}`);
  
  if (!product || !product.categories || product.categories.length === 0) {
    return res.json({
      success: true,
      data: [],
      count: 0
    });
  }
  
  const categoryIds = product.categories.map(cat => cat.id).join(',');
  const relatedProducts = await wooCommerceClient.get('/products', {
    category: categoryIds,
    per_page: parseInt(per_page) + 1,
    exclude: [parseInt(id)],
    status: 'publish'
  });
  
  res.json({
    success: true,
    data: transformProducts(relatedProducts.slice(0, parseInt(per_page))),
    count: relatedProducts.length
  });
}));

module.exports = router;