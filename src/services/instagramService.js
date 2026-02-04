const axios = require('axios');
const logger = require('../utils/logger');
const nodeCache = require('node-cache');

// Cache for 1 hour
const cache = new nodeCache({ stdTTL: 3600 });

// MOCK DATA until you provide a valid Access Token
const MOCK_FEED = [
  {
    id: '179123456789',
    media_type: 'VIDEO',
    media_url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-applying-makeup-in-front-of-mirror-3937-large.mp4',
    thumbnail_url: 'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
    caption: 'Summer Makeup Tutorial ☀️ #summer #makeup',
    permalink: 'https://instagram.com'
  },
  {
    id: '179987654321',
    media_type: 'VIDEO',
    media_url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-applying-lipstick-close-up-1234-large.mp4',
    thumbnail_url: 'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
    caption: 'Glam Night Out Look 💄 #glam #nightout',
    permalink: 'https://instagram.com'
  },
  {
    id: '178555555555',
    media_type: 'VIDEO',
    media_url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-putting-on-mascara-1235-large.mp4',
    thumbnail_url: 'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
    caption: 'Natural Everyday Beauty 🌿 #natural #beauty',
    permalink: 'https://instagram.com'
  },
  {
    id: '178444444444',
    media_type: 'VIDEO',
    media_url: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-woman-applying-eyeliner-1236-large.mp4',
    thumbnail_url: 'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
    caption: 'Bold Lip Colors 💋 #bold #lips',
    permalink: 'https://instagram.com'
  }
];

const getLatestVideos = async (limit = 5) => {
  const cacheKey = 'instagram_feed';
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    logger.info('Instagram Service: Returning cached feed');
    return cachedData;
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    logger.warn('Instagram Service: No Access Token found. Returning mock data.');
    return MOCK_FEED.slice(0, limit);
  }

  try {
    logger.info('Instagram Service: Fetching from API');
    const response = await axios.get(`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&access_token=${accessToken}`);
    
    const videos = response.data.data
      .filter(item => item.media_type === 'VIDEO' || item.media_type === 'CAROUSEL_ALBUM')
      .slice(0, limit);

    cache.set(cacheKey, videos);
    return videos;
  } catch (error) {
    logger.error(`Instagram Service Error: ${error.message}`);
    return MOCK_FEED.slice(0, limit);
  }
};

module.exports = {
  getLatestVideos
};
