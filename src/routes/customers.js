const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

router.post('/', asyncHandler(async (req, res) => {
  const customerData = req.body;
  
  if (!customerData.email) {
    throw new ValidationError('Email is required');
  }
  
  const customer = await wooCommerceClient.post('/customers', customerData);
  
  res.status(201).json({
    success: true,
    data: customer,
    message: 'Customer created successfully'
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    per_page = 10,
    search = '',
    orderby = 'registered_date',
    order = 'desc'
  } = req.query;

  const params = {
    page: parseInt(page),
    per_page: parseInt(per_page),
    orderby,
    order
  };

  if (search) params.search = search;

  const customers = await wooCommerceClient.get('/customers', params);
  
  res.json({
    success: true,
    data: customers,
    pagination: {
      page: parseInt(page),
      per_page: parseInt(per_page),
      total: customers.length
    }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customer = await wooCommerceClient.get(`/customers/${id}`);
  
  res.json({
    success: true,
    data: customer
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const customer = await wooCommerceClient.put(`/customers/${id}`, updateData);
  
  res.json({
    success: true,
    data: customer,
    message: 'Customer updated successfully'
  });
}));

module.exports = router;