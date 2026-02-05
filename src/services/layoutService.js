const wooCommerceClient = require('./woocommerceClient');
const instagramService = require('./instagramService');
const logger = require('../utils/logger');

const getHomeLayout = async () => {
  try {
    logger.info('Layout Service: Generating Stitch UI home layout');

    const instaVideos = await instagramService.getLatestVideos(6);

    // Stitch UI Layout Configuration
    // Modern, magazine-style fashion app layout
    const layout = [
      // Hero Carousel - Main visual focus
      {
        type: 'hero_carousel',
        data: {
          slides: [
            {
              imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-10.webp',
              badge: { text: 'New Collection', color: '#661F1D' },
              title: 'Summer',
              titleAccent: 'Essentials',
              description: 'Discover the latest trends for the season with our curated collection.',
              ctaText: 'Shop Now',
              action: { type: 'filter', value: 'featured', title: 'Featured' }
            },
            {
              imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-5.webp',
              badge: { text: 'Premium Range', color: '#D4AF37' },
              title: 'Lipstick',
              titleAccent: 'Love',
              description: 'Bold colors and lasting formulas for every occasion.',
              ctaText: 'Explore',
              action: { type: 'category', value: 92, title: 'Lipsticks' }
            },
            {
              imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-4.webp',
              badge: { text: 'Up to 50% Off', color: '#EF4444' },
              title: 'Flash',
              titleAccent: 'Sale',
              description: 'Limited time offers on your favorite products.',
              ctaText: 'Shop Sale',
              action: { type: 'filter', value: 'on_sale', title: 'Sale' }
            }
          ],
          autoPlayInterval: 5000
        }
      },

      // Category Circles - Quick navigation
      {
        type: 'category_circles',
        title: 'Categories',
        data: {
          ids: [23, 29, 25, 92, 37, 27, 33],
          images: [
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-6.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-7.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-11.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-6.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-7.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp'
          
          ]
        }
      },

      // Promotional Banner
      {
        type: 'promo_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-6.webp',
          title: 'Get Ready',
          titleAccent: 'Glow',
          description: 'Premium foundations for a flawless base',
          ctaText: 'Shop Foundation',
          action: { type: 'category', value: 29, title: 'Foundation' }
        }
      },
      

      {
  "type": "product_list",
  "title": "Season Favorites ",
  "data": {
    "query_type": "ids",
    "card_style": "image_only",
    "layout": "slider_2_5",
    "ids": [
      9199,
      9107,
      9191,
      9099,
      9156,
      9122,
      9134,
      9117,
      9164,
      9183
    ],
    "images": [
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp"
    ]
  }
},

      // Flash Sale Section
      {
        type: 'flash_sale',
        title: 'Flash Sale',
        data: {
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          products: {
            query_type: 'on_sale',
            api_params: { per_page: 10 }
          }
        }
      },

      // Trending Videos Section
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

      {
  "type": "product_list",
  "title": "Season Favorites ",
  "data": {
    "query_type": "ids",
    "card_style": "image_only",
    "layout": "slider_2_5",
    "ids": [
      9117,
      9191,
      9107,
      9199,
      9134,
      9122,
      9156,
      9164,
      9099,
      9183
    ],
    "images": [
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp"
    ]
  }
},

      // Top Rated Products
      {
        type: 'top_rated',
        title: 'Top Rated Favorites',
        data: {
          query_type: 'top_rated',
          api_params: { orderby: 'rating', order: 'desc', per_page: 10 }
        }
      },

      // Best Sellers Section (using existing product_list)
      {
        type: 'product_list',
        title: 'Best Sellers',
        data: {
          query_type: 'best_selling',
          api_params: { per_page: 8 }
        }
      },

      {
  "type": "product_list",
  "title": "Season Favorites ",
  "data": {
    "query_type": "ids",
    "card_style": "image_only",
    "layout": "slider_2_5",
    "ids": [
      9122,
      9134,
      9099,
      9199,
      9164,
      9117,
      9156,
      9191,
      9183,
      9107
    ],
    "images": [
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp"
    ]
  }
},

      // Another Promo Banner
      {
        type: 'promo_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-6.webp',
          title: 'Glow',
          titleAccent: 'Up',
          description: 'Highlighters that make you shine',
          ctaText: 'Shop Highlighters',
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
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-6.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-7.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-11.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-6.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-7.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp'
          ]
        }
      },

      {
  "type": "product_list",
  "title": "Season Favorites ",
  "data": {
    "query_type": "ids",
    "card_style": "image_only",
    "layout": "slider_2_5",
    "ids": [
      9164,
      9156,
      9117,
      9183,
      9107,
      9122,
      9191,
      9199,
      9134,
      9099
    ],
    "images": [
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp",
      "https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp"
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

      // Reward Program Card
      {
        type: 'reward_card',
        data: {
          title: 'Join Our Rewards Program',
          description: 'Earn points on every purchase and unlock exclusive perks, early access to sales, and birthday rewards.',
          ctaText: 'Learn More'
        }
      },

      // Featured Products Grid
      {
        type: 'product_list',
        title: "Trending Mini's",
        data: {
          query_type: 'ids',
          layout: 'slider_2_5',
          ids: [9199, 9191, 9183, 9164, 9156, 9134]
        }
      },

      // Exclusive Looks Slider
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

      // Season Favorites
      {
        type: 'product_list',
        title: 'Season Favorites',
        data: {
          query_type: 'ids',
          card_style: 'image_only',
          layout: 'slider_2_5',
          ids: [9199, 9191, 9183, 9164, 9156, 9134, 9122, 9117, 9107, 9099],
          images: [
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-9.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-8.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-3.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-2.webp',
            'https://makeupocean.com/wp-content/uploads/2026/02/unnamed-1.webp'
            
          ]
        }
      },
      // Grid Collection 1 (3 Columns)
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

      // Grid Collection 2 (2 Columns)
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

    logger.info('Layout Service: Returning ' + layout.length + ' sections');
    return layout;

  } catch (error) {
    logger.error('Error generating home layout: ' + error.message);
    return [];
  }
};

module.exports = {
  getHomeLayout
};
