const wooCommerceClient = require('./woocommerceClient');
const logger = require('../utils/logger');

/**
 * Lightweight catalog search — returns only the 2-3 most relevant products
 * with minimal metadata to keep AI context lean and response times fast.
 */
class CatalogSearch {
  /**
   * Search products by keyword. Strips heavy metadata, returns lean JSON.
   * @param {string} query - User search term (e.g. "matte foundation")
   * @param {number} limit - Max results (default 3, hard cap 5)
   * @returns {Array} Lean product objects
   */
  async search(query, limit = 3) {
    if (!query || typeof query !== 'string') return [];
    limit = Math.min(limit, 5);

    try {
      const products = await wooCommerceClient.get('/products', {
        search: query.trim(),
        per_page: limit,
        status: 'publish',
        orderby: 'popularity',
        _fields: 'id,name,price,regular_price,sale_price,stock_status,short_description,images,permalink,average_rating,categories'
      }, { useCache: true, cacheTTL: 120 });

      return this._transform(products);
    } catch (error) {
      logger.error('CatalogSearch.search failed:', error.message);
      return [];
    }
  }

  /**
   * Search products by category name
   */
  async searchByCategory(categoryName, limit = 3) {
    if (!categoryName) return [];
    limit = Math.min(limit, 5);

    try {
      // First find the category ID
      const categories = await wooCommerceClient.get('/products/categories', {
        search: categoryName.trim(),
        per_page: 1,
        _fields: 'id,name'
      }, { useCache: true, cacheTTL: 300 });

      if (!categories || categories.length === 0) {
        return this.search(categoryName, limit);
      }

      const products = await wooCommerceClient.get('/products', {
        category: categories[0].id,
        per_page: limit,
        status: 'publish',
        orderby: 'popularity',
        _fields: 'id,name,price,regular_price,sale_price,stock_status,short_description,images,permalink,average_rating'
      }, { useCache: true, cacheTTL: 120 });

      return this._transform(products);
    } catch (error) {
      logger.error('CatalogSearch.searchByCategory failed:', error.message);
      return [];
    }
  }

  /**
   * Get a single product by ID (for addToCart, order tracking)
   */
  async getProduct(productId) {
    try {
      const product = await wooCommerceClient.get(`/products/${productId}`, {
        _fields: 'id,name,price,regular_price,sale_price,stock_status,short_description,images,permalink,average_rating,variations'
      }, { useCache: true, cacheTTL: 120 });

      return this._transformOne(product);
    } catch (error) {
      logger.error(`CatalogSearch.getProduct(${productId}) failed:`, error.message);
      return null;
    }
  }

  /**
   * Check order status
   */
  async getOrderStatus(orderId, customerId) {
    try {
      const order = await wooCommerceClient.get(`/orders/${orderId}`, {}, { useCache: false });

      // Verify the order belongs to the customer
      if (customerId && order.customer_id !== customerId) {
        return { error: 'Order not found for this customer' };
      }

      return {
        id: order.id,
        status: order.status,
        total: order.total,
        currency: order.currency,
        date_created: order.date_created,
        items: (order.line_items || []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          total: item.total
        })),
        shipping: order.shipping_lines?.[0]?.method_title || 'Standard'
      };
    } catch (error) {
      logger.error(`CatalogSearch.getOrderStatus(${orderId}) failed:`, error.message);
      return { error: 'Could not retrieve order status' };
    }
  }

  /**
   * Strip heavy metadata, return only what the AI needs.
   */
  _transform(products) {
    if (!Array.isArray(products)) return [];
    return products.map(p => this._transformOne(p));
  }

  _transformOne(p) {
    if (!p) return null;
    const image = p.images?.[0]?.src || null;
    const desc = (p.short_description || '')
      .replace(/<[^>]*>/g, '')  // Strip HTML
      .substring(0, 120);       // Truncate

    return {
      id: p.id,
      name: p.name,
      price: p.price,
      regular_price: p.regular_price || p.price,
      sale_price: p.sale_price || null,
      on_sale: !!p.sale_price && p.sale_price !== p.price,
      in_stock: p.stock_status === 'instock',
      description: desc,
      image,
      rating: p.average_rating || null,
      category: p.categories?.[0]?.name || null,
      permalink: p.permalink || null
    };
  }
}

module.exports = new CatalogSearch();
