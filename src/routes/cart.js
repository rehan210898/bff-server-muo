const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

router.post('/validate', asyncHandler(async (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Cart items are required');
  }

  const validationResults = [];
  
  for (const item of items) {
    try {
      const product = await wooCommerceClient.get(`/products/${item.product_id}`);
      
      const validation = {
        product_id: item.product_id,
        valid: true,
        errors: []
      };

      if (!product || product.status !== 'publish') {
        validation.valid = false;
        validation.errors.push('Product not available');
      }

      if (product.manage_stock && product.stock_quantity < item.quantity) {
        validation.valid = false;
        validation.errors.push(`Only ${product.stock_quantity} items available`);
      }

      if (product.stock_status !== 'instock') {
        validation.valid = false;
        validation.errors.push('Product out of stock');
      }

      validation.product = {
        id: product.id,
        name: product.name,
        price: product.price,
        stock_status: product.stock_status
      };

      validationResults.push(validation);
    } catch (error) {
      validationResults.push({
        product_id: item.product_id,
        valid: false,
        errors: ['Product not found']
      });
    }
  }

  const allValid = validationResults.every(r => r.valid);

  res.json({
    success: true,
    valid: allValid,
    items: validationResults
  });
}));

router.post('/calculate', asyncHandler(async (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Cart items are required');
  }

  let subtotal = 0;
  const calculatedItems = [];

  for (const item of items) {
    const product = await wooCommerceClient.get(`/products/${item.product_id}`);
    
    const itemPrice = parseFloat(product.price) || 0;
    const itemTotal = itemPrice * item.quantity;
    
    subtotal += itemTotal;
    
    calculatedItems.push({
      product_id: item.product_id,
      name: product.name,
      quantity: item.quantity,
      price: itemPrice,
      total: itemTotal
    });
  }

  res.json({
    success: true,
    cart: {
      items: calculatedItems,
      subtotal: subtotal.toFixed(2),
      total: subtotal.toFixed(2)
    }
  });
}));

module.exports = router;