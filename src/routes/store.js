const express = require('express');
const router = express.Router();
const wooCommerceClient = require('../services/woocommerceClient');
const { asyncHandler } = require('../middleware/errorHandler');

const NAMESPACE = 'wc/store/v1';

// Helpers
const getNonce = (req) => req.headers['x-wc-store-api-nonce'];
const getCookie = (req) => req.headers['cookie'];
const getPaymentMethod = (req) => req.headers['x-wc-payment-method'];

const forwardHeaders = (res, resultHeaders) => {
  // Handle Nonce (normalize from upstream 'nonce' or 'x-wc-store-api-nonce')
  const nonce = resultHeaders['nonce'] || resultHeaders['x-wc-store-api-nonce'];
  if (nonce) {
    res.setHeader('X-WC-Store-API-Nonce', nonce);
  }

  // Handle Cart Token
  if (resultHeaders['cart-token']) {
    res.setHeader('Cart-Token', resultHeaders['cart-token']);
  }

  // Expose headers
  res.setHeader('Access-Control-Expose-Headers', 'X-WC-Store-API-Nonce, Set-Cookie, Cart-Token');

  if (resultHeaders['set-cookie']) {
    res.setHeader('Set-Cookie', resultHeaders['set-cookie']);
  }
};

const fetchNewSession = async (existingCookie = null, paymentMethod = null) => {
  try {
    const headers = {};
    if (existingCookie) headers['Cookie'] = existingCookie;
    if (paymentMethod) headers['X-WC-Payment-Method'] = paymentMethod;

    const response = await wooCommerceClient.get('/cart', {}, {
      namespace: NAMESPACE,
      useCache: false,
      returnHeaders: true,
      auth: false,
      headers
    });
    
    const newNonce = response.headers['nonce'] || response.headers['x-wc-store-api-nonce'];
    return {
      nonce: newNonce,
      cartToken: response.headers['cart-token'],
      cookie: response.headers['set-cookie'] 
        ? (Array.isArray(response.headers['set-cookie']) 
            ? response.headers['set-cookie'].join('; ') 
            : response.headers['set-cookie']) 
        : existingCookie
    };
  } catch (error) {
    console.error('Failed to fetch new session:', error.message);
    return { nonce: null, cookie: null };
  }
};

const ensureSession = async (req) => {
  const nonce = getNonce(req);
  const cookie = getCookie(req);
  const paymentMethod = getPaymentMethod(req);

  if (nonce && cookie) {
    return { nonce, cookie, paymentMethod }; // Pass payment method through
  }

  return await fetchNewSession(cookie, paymentMethod);
};

const executeWithRetry = async (req, res, actionFn) => {
  try {
    const result = await actionFn();
    return result;
  } catch (error) {
    // Check for 403 or specific nonce error
    if (error.status === 403 || error.code === 'woocommerce_rest_nonce_invalid') {
      console.log('🔄 Stale nonce detected (403), refreshing session and retrying...');
      
      const paymentMethod = getPaymentMethod(req);
      const session = await fetchNewSession(null, paymentMethod);
      
      const headers = {};
      if (session.nonce) {
          headers['X-WC-Store-API-Nonce'] = session.nonce;
          headers['Nonce'] = session.nonce;
      }
      if (session.cartToken) headers['Cart-Token'] = session.cartToken;
      if (session.cookie) headers['Cookie'] = session.cookie;
      if (paymentMethod) headers['X-WC-Payment-Method'] = paymentMethod;

      const result = await actionFn(headers);
      return result;
    }
    throw error;
  }
};

// GET Cart
router.get('/cart', asyncHandler(async (req, res) => {
  const cookie = getCookie(req);
  const nonce = getNonce(req);
  const paymentMethod = getPaymentMethod(req);
  
  const headers = {};
  if (nonce) {
      headers['X-WC-Store-API-Nonce'] = nonce;
      headers['Nonce'] = nonce;
  }
  if (cookie) headers['Cookie'] = cookie;
  if (paymentMethod) headers['X-WC-Payment-Method'] = paymentMethod;

  const result = await wooCommerceClient.get('/cart', {}, { 
    namespace: NAMESPACE,
    useCache: false,
    headers,
    returnHeaders: true,
    auth: false
  });

  forwardHeaders(res, result.headers);
  res.json(result.data);
}));

// Update Customer
router.post('/cart/update-customer', asyncHandler(async (req, res) => {
  const initialSession = await ensureSession(req);
  
  const getHeaders = (session) => {
      const h = {};
      if (session.nonce) {
          h['X-WC-Store-API-Nonce'] = session.nonce;
          h['Nonce'] = session.nonce;
      }
      if (session.cartToken) h['Cart-Token'] = session.cartToken;
      if (session.cookie) h['Cookie'] = session.cookie;
      if (session.paymentMethod) h['X-WC-Payment-Method'] = session.paymentMethod;
      return h;
  };

  const result = await executeWithRetry(req, res, async (overrideHeaders) => {
      const headers = overrideHeaders || getHeaders(initialSession);
      return await wooCommerceClient.post('/cart/update-customer', req.body, {}, {
        namespace: NAMESPACE,
        headers,
        returnHeaders: true
      });
  });

  forwardHeaders(res, result.headers);
  res.json(result.data);
}));

// Select Shipping Rate
router.post('/cart/select-shipping-rate', asyncHandler(async (req, res) => {
  const initialSession = await ensureSession(req);

  const getHeaders = (session) => {
      const h = {};
      if (session.nonce) {
          h['X-WC-Store-API-Nonce'] = session.nonce;
          h['Nonce'] = session.nonce;
      }
      if (session.cartToken) h['Cart-Token'] = session.cartToken;
      if (session.cookie) h['Cookie'] = session.cookie;
      if (session.paymentMethod) h['X-WC-Payment-Method'] = session.paymentMethod;
      return h;
  };

  const result = await executeWithRetry(req, res, async (overrideHeaders) => {
      const headers = overrideHeaders || getHeaders(initialSession);
      return await wooCommerceClient.post('/cart/select-shipping-rate', req.body, {}, {
        namespace: NAMESPACE,
        headers,
        returnHeaders: true
      });
  });

  forwardHeaders(res, result.headers);
  res.json(result.data);
}));

// Apply Coupon
router.post('/cart/coupons', asyncHandler(async (req, res) => {
  const initialSession = await ensureSession(req);

  const getHeaders = (session) => {
      const h = {};
      if (session.nonce) {
          h['X-WC-Store-API-Nonce'] = session.nonce;
          h['Nonce'] = session.nonce;
      }
      if (session.cartToken) h['Cart-Token'] = session.cartToken;
      if (session.cookie) h['Cookie'] = session.cookie;
      if (session.paymentMethod) h['X-WC-Payment-Method'] = session.paymentMethod;
      return h;
  };

  const result = await executeWithRetry(req, res, async (overrideHeaders) => {
      const headers = overrideHeaders || getHeaders(initialSession);
      return await wooCommerceClient.post('/cart/coupons', req.body, {}, {
        namespace: NAMESPACE,
        headers,
        returnHeaders: true
      });
  });

  forwardHeaders(res, result.headers);
  res.json(result.data);
}));

// Remove Coupon
router.delete('/cart/coupons/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const initialSession = await ensureSession(req);

  const getHeaders = (session) => {
      const h = {};
      if (session.nonce) {
          h['X-WC-Store-API-Nonce'] = session.nonce;
          h['Nonce'] = session.nonce;
      }
      if (session.cartToken) h['Cart-Token'] = session.cartToken;
      if (session.cookie) h['Cookie'] = session.cookie;
      if (session.paymentMethod) h['X-WC-Payment-Method'] = session.paymentMethod;
      return h;
  };

  const result = await executeWithRetry(req, res, async (overrideHeaders) => {
      const headers = overrideHeaders || getHeaders(initialSession);
      // DELETE requests in axios with headers need careful config
      // wooCommerceClient.delete signature: (endpoint, params = {}, options = {})
      
      return await wooCommerceClient.delete(`/cart/coupons/${code}`, {}, {
          namespace: NAMESPACE,
          headers,
          returnHeaders: true
      });
  });

  forwardHeaders(res, result.headers);
  res.json(result.data);
}));

// List Available Coupons (New)
router.get('/coupons', asyncHandler(async (req, res) => {
    // Fetch coupons from standard WC API (v3)
    // We can cache this heavily as coupons don't change often
    const coupons = await wooCommerceClient.get('/coupons', {
        per_page: 50, // Limit to 50 active coupons
        status: 'publish' // Only published coupons
    }, {
        namespace: 'wc/v3',
        useCache: true,
        cacheTTL: 60 * 60 // 1 hour cache
    });

    // Simplify response for mobile
    const now = new Date();
    const simplified = coupons
        .filter(c => {
            // Check expiry if it exists
            if (c.date_expires) {
                const expiry = new Date(c.date_expires);
                if (expiry < now) return false;
            }
            return true;
        })
        .map(c => ({
            id: c.id,
            code: c.code,
            amount: c.amount,
            discount_type: c.discount_type,
            description: c.description,
            minimum_amount: c.minimum_amount,
            maximum_amount: c.maximum_amount,
            date_expires: c.date_expires
        }));

    res.json(simplified);
}));

// Sync Cart (True Sync: Set State)
router.post('/cart/sync', asyncHandler(async (req, res) => {
  const { items } = req.body;
  
  // 1. Initial Session & Fetch Current Cart
  let session = await ensureSession(req);
  let headers = {};
  
  const updateHeaders = (s) => {
      headers = {};
      if (s.nonce) {
          headers['X-WC-Store-API-Nonce'] = s.nonce;
          headers['Nonce'] = s.nonce;
      }
      if (s.cartToken) headers['Cart-Token'] = s.cartToken;
      if (s.cookie) headers['Cookie'] = s.cookie;
      if (s.paymentMethod) headers['X-WC-Payment-Method'] = s.paymentMethod;
  };
  updateHeaders(session);

  // Helper to execute with session refresh
  const executeStoreAction = async (fn) => {
      try {
          return await fn(headers);
      } catch (err) {
          if (err.status === 403 || err.code === 'woocommerce_rest_nonce_invalid') {
              console.log('🔄 Sync: Stale nonce (403), refreshing...');
              session = await fetchNewSession();
              updateHeaders(session);
              return await fn(headers);
          }
          throw err;
      }
  };

  // Fetch current server cart
  const currentCartRes = await executeStoreAction((h) => wooCommerceClient.get('/cart', {}, {
      namespace: NAMESPACE,
      useCache: false,
      headers: h,
      returnHeaders: true
  }));
  
  // Update session from read
  const refreshSessionFromHeaders = (resHeaders) => {
      const newNonce = resHeaders['nonce'] || resHeaders['x-wc-store-api-nonce'];
      if (newNonce) session.nonce = newNonce;
      if (resHeaders['cart-token']) session.cartToken = resHeaders['cart-token'];
      if (resHeaders['set-cookie']) {
           const newCookie = Array.isArray(resHeaders['set-cookie']) 
              ? resHeaders['set-cookie'].join('; ') 
              : resHeaders['set-cookie'];
           session.cookie = newCookie; // logic for merging cookies might be needed if complex
      }
      updateHeaders(session);
  };
  refreshSessionFromHeaders(currentCartRes.headers);

  const serverItems = currentCartRes.data.items || [];
  
  // 2. Calculate Diff
  const incomingItems = items || [];
  
  // Map for easy lookup: `${product_id}-${variation_id}`
  const getKey = (id, vid) => `${id}-${vid || 0}`;
  
  const serverMap = new Map();
  serverItems.forEach(item => {
      // API returns 'id' (product_id) and 'quantity'. variations have their own entry? 
      // Actually Store API items have 'id' which is product ID, but unique key is item 'key'.
      // Wait, Store API returns items array. Each item has 'key', 'id' (product_id), 'quantity', 'variation_id'.
      // We need to match by product_id and variation_id.
      // NOTE: server item 'id' is product_id.
      // item.variation_id is explicit.
      const key = getKey(item.id, item.variation_id);
      serverMap.set(key, item);
  });

  // Actions
  const toAdd = [];
  const toUpdate = [];
  const keptKeys = new Set();

  for (const item of incomingItems) {
      const key = getKey(item.product_id, item.variation_id);
      const serverItem = serverMap.get(key);
      
      if (serverItem) {
          keptKeys.add(key);
          if (serverItem.quantity !== item.quantity) {
              toUpdate.push({ 
                  key: serverItem.key, // Need 'key' to update
                  quantity: item.quantity 
              });
          }
      } else {
          toAdd.push({
              id: item.product_id,
              quantity: item.quantity,
              variation_id: item.variation_id
          });
      }
  }

  const toRemove = [];
  serverMap.forEach((item, key) => {
      if (!keptKeys.has(key)) {
          toRemove.push(item.key); // Need 'key' to remove
      }
  });

  console.log(`Sync Logic: Add ${toAdd.length}, Update ${toUpdate.length}, Remove ${toRemove.length}`);

  // 3. Execute Updates (Sequential to maintain Nonce/Session)
  
  // Remove items first
  for (const key of toRemove) {
      try {
           const res = await executeStoreAction((h) => wooCommerceClient.post('/cart/remove-item', { key }, {}, {
              namespace: NAMESPACE,
              headers: h,
              returnHeaders: true
          }));
          refreshSessionFromHeaders(res.headers);
      } catch (e) { console.error('Failed to remove item', key, e.message); }
  }

  // Update items
  for (const update of toUpdate) {
      try {
          const res = await executeStoreAction((h) => wooCommerceClient.post('/cart/update-item', { 
              key: update.key, 
              quantity: update.quantity 
          }, {}, {
              namespace: NAMESPACE,
              headers: h,
              returnHeaders: true
          }));
          refreshSessionFromHeaders(res.headers);
      } catch (e) { console.error('Failed to update item', update.key, e.message); }
  }

  // Add items
  for (const add of toAdd) {
      try {
          const res = await executeStoreAction((h) => wooCommerceClient.post('/cart/add-item', { 
              id: add.id, 
              quantity: add.quantity,
              variation_id: add.variation_id
          }, {}, {
              namespace: NAMESPACE,
              headers: h,
              returnHeaders: true
          }));
          refreshSessionFromHeaders(res.headers);
      } catch (e) { console.error('Failed to add item', add.id, e.message); }
  }

  // Final fetch to return consistent state
  const finalCart = await executeStoreAction((h) => wooCommerceClient.get('/cart', {}, {
      namespace: NAMESPACE,
      useCache: false,
      headers: h,
      returnHeaders: true
  }));

  forwardHeaders(res, finalCart.headers);
  res.json(finalCart.data);
}));

module.exports = router;