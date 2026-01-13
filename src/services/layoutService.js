const wooCommerceClient = require('./woocommerceClient');
const logger = require('../utils/logger');

const getHomeLayout = async () => {
  try {
    logger.info('Layout Service: Fetching home layout from app/v1/home');
    
    // Fetch from the WordPress Native App Home Page endpoint
    const layout = await wooCommerceClient.get('/home', {}, { 
      namespace: 'app/v1',
      auth: false // Endpoint is public, avoid sending Basic Auth which might trigger login errors
    });

    if (!layout || !Array.isArray(layout)) {
      logger.warn('Layout Service: Invalid layout format or empty response from WP');
      return [];
    }

    logger.info(`Layout Service: Successfully fetched ${layout.length} sections`);
    return layout;

  } catch (error) {
    logger.error(`Error fetching home layout from app/v1/home: ${error.message}`);
    // Return empty array on error to avoid crashing the app
    return [];
  }
};

module.exports = {
  getHomeLayout
};