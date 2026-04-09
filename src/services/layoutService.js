const wooCommerceClient = require('./woocommerceClient');
const logger = require('../utils/logger');

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
 * Hardcoded fallback layout — used when WordPress layout is not configured.
 */
const getFallbackLayout = () => {
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

    // Season Favorites — slider with custom images
    {
      type: 'product_slider_image',
      title: 'Season Favorites',
      data: {
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

    // Flash Sale (fixed end time)
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

    // Products In Spotlight — slider with custom images
    {
      type: 'product_slider_image',
      title: 'Products In Spotlight',
      data: {
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

    // Trending Videos — provide your own video URLs in WordPress
    {
      type: 'trending_videos',
      title: 'Trending Now',
      data: {
        videos: [
          {
            id: 1,
            imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/video-thumb-1.webp',
            title: 'Summer Glow Tutorial',
            videoUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/video1.mp4'
          },
          {
            id: 2,
            imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/video-thumb-2.webp',
            title: 'Lipstick Shades Guide',
            videoUrl: 'https://makeupocean.com/wp-content/uploads/2026/03/video2.mp4'
          }
        ]
      }
    },

    // Top Picks — slider with default cards
    {
      type: 'product_slider',
      title: 'Top Picks of the Month',
      data: {
        ids: [9122, 9134, 9099, 9199, 9164, 9117, 9156, 9191]
      }
    },

    // Exclusive Deals — slider with custom images
    {
      type: 'product_slider_image',
      title: 'Exclusive Deals',
      data: {
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

    // New Arrivals — slider with default cards
    {
      type: 'product_slider',
      title: 'New Arrivals',
      data: {
        ids: [9199, 9191, 9183, 9164, 9156, 9134, 9122, 9117]
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

    // Trending Mini's — slider with default cards
    {
      type: 'product_slider',
      title: "Trending Mini's",
      data: {
        ids: [9199, 9191, 9183, 9164, 9156, 9134]
      }
    },

    // Exclusive Looks — slider with custom images
    {
      type: 'product_slider_image',
      title: 'Exclusive Looks',
      data: {
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

    // Grid 3x3 with custom images
    {
      type: 'product_grid_3x3_image',
      title: 'Grid Collection',
      data: {
        ids: [9199, 9191, 9183, 9164, 9156, 9134],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
          'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp'
        ],
        background: '#F8F5F0'
      }
    },

    // Grid 2x2 with custom images
    {
      type: 'product_grid_2x2_image',
      title: 'Must Haves',
      data: {
        ids: [9199, 9191, 9183, 9164],
        images: [
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp',
          'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp'
        ],
        background: '#FFF0F5'
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
      logger.info('Layout Service: Returning WordPress layout (' + wpLayout.length + ' sections)');
      return wpLayout;
    }

    // Step 2: Fallback to hardcoded layout
    logger.info('Layout Service: Using fallback hardcoded layout');
    const fallbackLayout = getFallbackLayout();
    logger.info('Layout Service: Returning fallback layout (' + fallbackLayout.length + ' sections)');
    return fallbackLayout;

  } catch (error) {
    logger.error('Error generating home layout: ' + error.message);
    return [];
  }
};

/**
 * Fetch category layout from WordPress custom endpoint.
 * Returns array of { id, name, image } for the categories screen.
 */
const fetchCategoryLayoutFromWordPress = async () => {
  try {
    const data = await wooCommerceClient.get(
      '/app-category-layout',
      {},
      { namespace: 'muo/v1', useCache: false, auth: false }
    );

    if (data && data.success && Array.isArray(data.data)) {
      logger.info('Layout Service: Loaded category layout from WordPress (' + data.data.length + ' categories)');
      return data.data;
    }

    logger.info('Layout Service: No WordPress category layout configured');
    return null;
  } catch (error) {
    logger.warn('Layout Service: Could not fetch category layout from WordPress: ' + error.message);
    return null;
  }
};

const getCategoryLayout = async () => {
  try {
    // Try WordPress first
    const wpCategories = await fetchCategoryLayoutFromWordPress();
    if (wpCategories) {
      return wpCategories;
    }

    // Fallback: fetch from WooCommerce and return all with count > 0
    logger.info('Layout Service: Using WooCommerce categories as fallback');
    const wcCategories = await wooCommerceClient.get('/products/categories', {
      per_page: 100,
      hide_empty: true,
      orderby: 'name',
      order: 'asc'
    });

    if (Array.isArray(wcCategories)) {
      return wcCategories
        .filter(c => (c.count || 0) > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          parent: c.parent || 0,
          image: c.image ? c.image.src : null
        }));
    }

    return [];
  } catch (error) {
    logger.error('Error getting category layout: ' + error.message);
    return [];
  }
};

/**
 * Fetch category tree: main categories with nested subcategories.
 * Used by the new vertical-tab category screen.
 */
const fetchCategoryTreeFromWordPress = async () => {
  try {
    const data = await wooCommerceClient.get(
      '/app-category-tree',
      {},
      { namespace: 'muo/v1', useCache: false, auth: false }
    );

    if (data && data.success && Array.isArray(data.data)) {
      logger.info('Layout Service: Loaded category tree from WordPress (' + data.data.length + ' main categories)');
      return data.data;
    }

    logger.info('Layout Service: No WordPress category tree configured');
    return null;
  } catch (error) {
    logger.warn('Layout Service: Could not fetch category tree from WordPress: ' + error.message);
    return null;
  }
};

const getCategoryTree = async () => {
  try {
    // Try WordPress first
    const wpTree = await fetchCategoryTreeFromWordPress();
    if (wpTree) {
      return wpTree;
    }

    // Fallback: build tree from WooCommerce categories
    logger.info('Layout Service: Building category tree from WooCommerce');
    const wcCategories = await wooCommerceClient.get('/products/categories', {
      per_page: 100,
      hide_empty: true,
      orderby: 'name',
      order: 'asc'
    });

    if (!Array.isArray(wcCategories)) return [];

    const active = wcCategories.filter(c => (c.count || 0) > 0);

    // Separate main categories (parent=0) and subcategories
    const mainCats = active.filter(c => c.parent === 0);
    const subCats = active.filter(c => c.parent !== 0);

    // Build tree
    const tree = mainCats.map(main => ({
      id: main.id,
      name: main.name,
      image: main.image ? main.image.src : null,
      subcategories: subCats
        .filter(sub => sub.parent === main.id)
        .map(sub => ({
          id: sub.id,
          name: sub.name,
          image: sub.image ? sub.image.src : null
        }))
    }));

    // Only return main categories that have subcategories, plus those without (they act as leaf categories)
    return tree;
  } catch (error) {
    logger.error('Error getting category tree: ' + error.message);
    return [];
  }
};

module.exports = {
  getHomeLayout,
  getCategoryLayout,
  getCategoryTree
};
