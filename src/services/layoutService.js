const wooCommerceClient = require('./woocommerceClient');
const instagramService = require('./instagramService');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const WP_LAYOUT_CACHE_KEY = 'wp_home_layout';
const WP_LAYOUT_CACHE_TTL = 300; // 5 minutes

/**
 * Fetch home layout from WordPress custom endpoint.
 * Returns null if not configured or on error (triggers fallback).
 */
const fetchLayoutFromWordPress = async () => {
  try {
    const data = await wooCommerceClient.get(
      '/app-layout',
      {},
      { namespace: 'muo/v1', useCache: false, auth: false }
    );

    if (data && data.success && Array.isArray(data.data)) {
      logger.info('Layout Service: Loaded layout from WordPress (' + data.data.length + ' sections)');
      return data.data;
    }

    // WordPress returned success:false — no layout configured
    logger.info('Layout Service: No WordPress layout configured, using fallback');
    return null;
  } catch (error) {
    logger.warn('Layout Service: Could not fetch from WordPress: ' + error.message + '. Using fallback.');
    return null;
  }
};

/**
 * Process layout sections that need dynamic data (e.g., Instagram videos, flash sale timer).
 */
const enrichLayout = async (layout) => {
  const enriched = [];

  for (const section of layout) {
    if (section.type === 'trending_videos') {
      // Fetch Instagram videos dynamically
      try {
        const instaVideos = await instagramService.getLatestVideos(6);
        enriched.push({
          ...section,
          data: {
            ...section.data,
            videos: instaVideos.map(v => ({
              id: v.id,
              imageUrl: v.thumbnail_url || v.media_url,
              title: v.caption ? v.caption.substring(0, 50) + (v.caption.length > 50 ? '...' : '') : 'Instagram Reel',
              videoUrl: v.media_url
            }))
          }
        });
      } catch (error) {
        logger.warn('Layout Service: Failed to fetch Instagram videos: ' + error.message);
        enriched.push(section);
      }
    } else {
      enriched.push(section);
    }
  }

  return enriched;
};

/**
 * Hardcoded fallback layout — used when WordPress layout is not configured.
 */
const getFallbackLayout = async () => {
  const instaVideos = await instagramService.getLatestVideos(6);

  return [
    // Hero Carousel
    {
      type: 'hero_carousel',
      data: {
        slides: [
          {
            imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/The-1.jpg',
            action: { type: 'filter', value: 'featured', title: 'Featured' }
          },
          {
            imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/App-Assets-1-1.webp',
            action: { type: 'category', value: 92, title: 'Lipsticks' }
          },
          {
            imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/Makeup-4.jpg',
            action: { type: 'filter', value: 'on_sale', title: 'Sale' }
          }
        ],
        autoPlayInterval: 5000
      }
    },

    // Category Circles
    {
      type: 'category_circles',
      title: 'Explore Beauty',
      data: {
        ids: [23, 29, 25, 92, 37, 27, 33],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/03/2150260884.jpg',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-12.png',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-13.png',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-18.jpg',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-19.jpg',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-20.jpg'
        ]
      }
    },

    // Promo Banner
    {
      type: 'promo_banner',
      data: {
        imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/Add-a-heading-1.png',
        title: 'Get Ready',
        titleAccent: 'Glow',
        description: 'Premium foundations for a flawless base',
        ctaText: 'Shop Foundation',
        action: { type: 'category', value: 29, title: 'Foundation' }
      }
    },

    // Season Favorites (single section — duplicates removed)
    {
      type: 'product_list',
      title: 'Season Favorites',
      data: {
        query_type: 'ids',
        card_style: 'image_only',
        layout: 'slider_2_5',
        ids: [9199, 9107, 9191, 9099, 9156, 9122, 9134, 9117, 9164, 9183],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-1.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-2.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-3.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-4.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-5.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-6.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-7.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-8.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Translucent-Loose-Powder-9.webp'
        ]
      }
    },

    // Flash Sale (fixed end time instead of Date.now())
    {
      type: 'flash_sale',
      title: 'Flash Sale',
      data: {
        endTime: '2026-04-01T23:59:59.000Z',
        products: {
          query_type: 'on_sale',
          api_params: { per_page: 10 }
        }
      }
    },

    // Products In Spotlight
    {
      type: 'product_list',
      title: 'Products In Spotlight',
      data: {
        query_type: 'ids',
        card_style: 'image_only',
        layout: 'slider_2_5',
        ids: [9117, 9191, 9107, 9199, 9134, 9122, 9156, 9164, 9099, 9183],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-20.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/71DOJVAhaIL._SL1500_.jpg',
          'https://makeupocean.com/wp-content/uploads/2026/03/50-zero-sun-matte-gel-spf-50-pa-sunscreen-uva-uvb-with-original-imahhfrgzzfspsba.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/vitamin_c_serum.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/slide_1_c74572c6-6da9-485d-85ae-d68cc116dea7.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/slide1.webp',
          'https://makeupocean.com/wp-content/uploads/2025/12/BL02-02_SO_CHEEKY.webp',
          'https://makeupocean.com/wp-content/uploads/2024/04/SB-S6_203_Hazlenut_1800x1800.webp',
          'https://makeupocean.com/wp-content/uploads/2025/04/ChatGPT-Image-Apr-11-2025-05_31_19-PM.jpg',
          'https://makeupocean.com/wp-content/uploads/2026/01/T6_HYDRA_GLOW_PRIMER_WEB_5.webp'
        ]
      }
    },

    // Suggested For You
    {
      type: 'top_rated',
      title: 'Suggested For You',
      data: {
        query_type: 'top_rated',
        api_params: { orderby: 'rating', order: 'desc', per_page: 10 }
      }
    },

    // Trending Videos
    {
      type: 'trending_videos',
      title: 'Trending Now',
      data: {
        videos: instaVideos.map(v => ({
          id: v.id,
          imageUrl: v.thumbnail_url || v.media_url,
          title: v.caption ? v.caption.substring(0, 50) + (v.caption.length > 50 ? '...' : '') : 'Instagram Reel',
          videoUrl: v.media_url
        }))
      }
    },

    // Top Picks
    {
      type: 'product_list',
      title: 'Top Picks of the Month',
      data: {
        query_type: 'best_selling',
        api_params: { per_page: 8 }
      }
    },

    // Exclusive Deals
    {
      type: 'product_list',
      title: 'Exclusive Deals',
      data: {
        query_type: 'ids',
        card_style: 'image_only',
        layout: 'slider_2_5',
        ids: [9122, 9134, 9099, 9199, 9164, 9117, 9156, 9191, 9183, 9107],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/03/product_image-p100014-shade-01-natural-tint-0835.png',
          'https://makeupocean.com/wp-content/uploads/2026/02/aquablast_moisturizer.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-19.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-18.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Duo-Fiber-Stippling-Brush-8.jpg',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-17.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/slide6_dd595124-175e-4eba-a2c9-ad7be867d1fd.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-16.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-15.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-14.webp'
        ]
      }
    },

    // Promo Banner 2
    {
      type: 'promo_banner',
      data: {
        imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/Add-a-heading-2.webp',
        action: { type: 'category', value: 25, title: 'Highlighter' }
      }
    },

    // Brand Grid
    {
      type: 'brand_grid',
      title: 'Top Brands',
      data: {
        ids: [223, 135, 132, 163, 146, 221, 46],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-21.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-22.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-23.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-24.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-25.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-26.webp',
          'https://makeupocean.com/wp-content/uploads/2026/03/Untitled-design-27.webp'
        ]
      }
    },

    // New Arrivals
    {
      type: 'product_list',
      title: 'New Arrivals',
      data: {
        query_type: 'date',
        api_params: { per_page: 8 }
      }
    },

    // Reward Card
    {
      type: 'reward_card',
      data: {
        title: 'Join Our Rewards Program',
        description: 'Earn points on every purchase and unlock exclusive perks, early access to sales, and birthday rewards.',
        ctaText: 'Learn More'
      }
    },

    // Trending Mini's
    {
      type: 'product_list',
      title: "Trending Mini's",
      data: {
        query_type: 'ids',
        layout: 'slider_2_5',
        ids: [9199, 9191, 9183, 9164, 9156, 9134]
      }
    },

    // Exclusive Looks
    {
      type: 'product_list',
      title: 'Exclusive Looks',
      data: {
        query_type: 'ids',
        layout: 'slider_2_5',
        card_style: 'image_only',
        ids: [9122, 9117, 9107, 9099, 9089, 9084],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed.webp'
        ]
      }
    },

    // Grid Collection 1
    {
      type: 'product_list',
      title: 'Grid Collection 1',
      data: {
        query_type: 'ids',
        card_style: 'image_only',
        layout: 'grid_3_col',
        ids: [9199, 9191, 9183, 9164, 9156, 9134],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp'
        ]
      }
    },

    // Grid Collection 2
    {
      type: 'product_list',
      title: 'Grid Collection 2',
      data: {
        query_type: 'ids',
        card_style: 'image_only',
        layout: 'grid_2_col',
        ids: [9199, 9191, 9183, 9164],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp'
        ]
      }
    }
  ];
};

const getHomeLayout = async () => {
  try {
    logger.info('Layout Service: Generating home layout');

    // Step 1: Try to fetch layout from WordPress
    const wpLayout = await fetchLayoutFromWordPress();

    if (wpLayout) {
      // WordPress layout found — enrich dynamic sections (Instagram, etc.)
      const enrichedLayout = await enrichLayout(wpLayout);
      logger.info('Layout Service: Returning WordPress layout (' + enrichedLayout.length + ' sections)');
      return enrichedLayout;
    }

    // Step 2: Fallback to hardcoded layout
    logger.info('Layout Service: Using fallback hardcoded layout');
    const fallbackLayout = await getFallbackLayout();
    logger.info('Layout Service: Returning fallback layout (' + fallbackLayout.length + ' sections)');
    return fallbackLayout;

  } catch (error) {
    logger.error('Error generating home layout: ' + error.message);
    return [];
  }
};

module.exports = {
  getHomeLayout
};
