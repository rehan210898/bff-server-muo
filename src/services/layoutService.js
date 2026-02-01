const wooCommerceClient = require('./woocommerceClient');
const logger = require('../utils/logger');

const getHomeLayout = async () => {
  try {
    logger.info('Layout Service: Generatng static home layout');
    
    // Construct a static JSON object for the home screen
    // This allows us to control the app layout without relying on a specific WP plugin endpoint
    const layout = [
       {
        type: 'category_grid',
        title: 'Shop by Category',
        data: {
          ids: [23, 29, 25, 92, 37, 27, 33], // Eyeshadow, Foundation, Highlighter, Lipstick
          images: [
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-34.webp', // Eyeshadow
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-33.webp', // Foundation
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-32.webp', // Highlighter
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-31.webp', // Lipstick
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp',  // Compact Powder
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp',  // Compact Powder
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp'  // Compact Powder
          ]
        }
      },
     
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-28.webp', 
          action: { type: 'filter', value: 'featured', title: 'Featured' },
          title: 'New Season Essentials'
        }
      },
       {
        type: 'product_list',
        title: 'Best Sellers',
        data: {
          query_type: 'best_selling',
          api_params: { per_page: 5 }
        }
      },
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-27.webp', 
          action: { type: 'category', value: 92, title: 'Lipsticks' },
          title: 'Lipstick Love'
        }
      },
       {
        type: 'brand_grid',
        title: 'Top Brands',
        data: {
          ids: [223, 135, 132, 163, 146, 221, 46], // Lakme, Blue Heaven, MARS, Hilary Rhoda, Swiss Beauty, Maybelline, MeOn
          images: [
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-34.webp', // Eyeshadow
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-33.webp', // Foundation
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-32.webp', // Highlighter
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-31.webp', // Lipstick
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp',  // Compact Powder
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp',  // Compact Powder
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp'  // Compact Powder
          ]
        }
      },
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-21.webp', 
          action: { type: 'category', value: 29, title: 'Foundation' },
          title: 'Perfect Base'
        }
      },
      {
        type: 'product_list',
        title: 'Featured Products',
        data: {
          query_type: 'featured',
          api_params: { per_page: 5 }
        }
      },
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-22.webp', 
          action: { type: 'category', value: 25, title: 'Highlighter' },
          title: 'Glow Up'
        }
      },
      {
        type: 'product_list',
        title: 'Featured Products',
        data: {
          query_type: 'featured',
          api_params: { per_page: 5 }
        }
      },
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-23.webp', 
          action: { type: 'category', value: 23, title: 'Eyeshadow' },
          title: 'Eye Drama'
        }
      },
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-26.webp', 
          action: { type: 'filter', value: 'on_sale', title: 'Sale' },
          title: 'Super Sale'
        }
      },
      {
        type: 'product_list',
        title: 'Season Favorites',
        data: {
          query_type: 'ids',
          ids: [9199, 9191, 9183, 9164, 9156, 9134, 9122, 9117, 9107, 9099, 9089, 9084, 9048, 9042],
          images: [
           'https://makeupocean.com/wp-content/uploads/2026/01/img-1-34.webp', // Eyeshadow
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-33.webp', // Foundation
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-32.webp', // Highlighter
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-31.webp', // Lipstick
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-14.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-13.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-12.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-11.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-10.webp'
          ]
        }
      },
      {
        type: 'micro_animation',
        data: {}
      },
      
      {
        type: 'product_list',
        title: 'New Arrivals',
        data: {
          query_type: 'date',
          api_params: { per_page: 5 }
        }
      },
      {
        type: 'beauty_animation',
        data: {}
      },
      {
        type: 'product_list',
        title: 'Season Favorites',
        data: {
          query_type: 'ids',
          ids: [9199, 9191, 9183, 9164, 9156, 9134, 9122, 9117, 9107, 9099, 9089, 9084, 9048, 9042],
          images: [
           'https://makeupocean.com/wp-content/uploads/2026/01/img-1-34.webp', // Eyeshadow
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-33.webp', // Foundation
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-32.webp', // Highlighter
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-31.webp', // Lipstick
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-30.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-14.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-13.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-12.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-11.webp',
             'https://makeupocean.com/wp-content/uploads/2026/01/img-2-10.webp'
          ]
        }
      },
      {
        type: 'hero_banner',
        data: {
          imageUrl: 'https://makeupocean.com/wp-content/uploads/2026/01/img-1-29.webp', 
          action: 'product_list:featured',
          title: 'New Season Essentials'
        }
      },
      // 1. 3 col grid with two rows (6 items) - Original Image, Small Title, Price, %Off
      {
        type: 'product_list',
        title: "Trending Mini's",
        data: {
          query_type: 'ids',
          layout: 'grid_3_col',
          ids: [9199, 9191, 9183, 9164, 9156, 9134]
        }
      },
      // 2. Slider with 2.5 products visible - Custom/Dummy Images
      {
        type: 'product_list',
        title: 'Exclusive Looks',
        data: {
          query_type: 'ids',
          layout: 'slider_2_5',
          ids: [9122, 9117, 9107, 9099, 9089, 9084],
          images: [ // Dummy images as requested
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-18.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-9.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-17.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-16.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-15.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-14.webp'
          ]
        }
      },
      // 3. 3 col grid with two rows in Container
      {
        type: 'product_list',
        title: "Editor's Pick",
        data: {
          query_type: 'ids',
          layout: 'grid_3_col_container',
          ids: [9048, 9042, 9199, 9191, 9183, 9164]
        }
      },
      // 4. Copy of Section 1
      {
        type: 'product_list',
        title: 'Hot Deals',
        data: {
          query_type: 'ids',
          layout: 'grid_3_col',
          ids: [9156, 9134, 9122, 9117, 9107, 9099]
        }
      },
      // 5. Copy of Section 2 (Slider)
      {
        type: 'product_list',
        title: 'Just for You',
        data: {
          query_type: 'ids',
          layout: 'slider_2_5',
          ids: [9089, 9084, 9048, 9042, 9199, 9191],
           images: [
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-13.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-12.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-11.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-2-10.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-34.webp',
            'https://makeupocean.com/wp-content/uploads/2026/01/img-1-33.webp'
          ]
        }
      }
    ];

    logger.info(`Layout Service: Returning ${layout.length} sections`);
    return layout;

  } catch (error) {
    logger.error(`Error generating home layout: ${error.message}`);
    return [];
  }
};

module.exports = {
  getHomeLayout
};