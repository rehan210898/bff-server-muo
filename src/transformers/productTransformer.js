const transformProduct = (product) => {
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    type: product.type,
    status: product.status,
    featured: product.featured,
    description: product.description,
    shortDescription: product.short_description,
    sku: product.sku,
    price: product.price,
    regularPrice: product.regular_price,
    salePrice: product.sale_price,
    onSale: product.on_sale,
    priceHtml: product.price_html,
    images: product.images?.map(img => ({
      id: img.id,
      src: img.src,
      name: img.name,
      alt: img.alt
    })) || [],
    image: product.images?.[0]?.src || null,
    thumbnail: product.images?.[0]?.src || null,
    categories: product.categories?.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug
    })) || [],
    tags: product.tags?.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug
    })) || [],
    attributes: product.attributes?.map(attr => ({
      id: attr.id,
      name: attr.name,
      position: attr.position,
      visible: attr.visible,
      variation: attr.variation,
      options: attr.options
    })) || [],
    variations: product.variations || [],
    stockStatus: product.stock_status,
    stockQuantity: product.stock_quantity,
    inStock: product.stock_status === 'instock',
    manageStock: product.manage_stock,
    soldIndividually: product.sold_individually,
    maxQuantity: product.sold_individually 
      ? 1 
      : (product.manage_stock && product.stock_quantity !== null 
          ? product.stock_quantity 
          : 99), // Default max if not managed or sold individually
    backorders: product.backorders,
    backordersAllowed: product.backorders_allowed,
    averageRating: product.average_rating,
    ratingCount: product.rating_count,
    reviewsAllowed: product.reviews_allowed,
    weight: product.weight,
    dimensions: product.dimensions,
    relatedIds: product.related_ids || [],
    upsellIds: product.upsell_ids || [],
    crossSellIds: product.cross_sell_ids || [],
    downloadable: product.downloadable,
    virtual: product.virtual,
    dateCreated: product.date_created,
    dateModified: product.date_modified,
    permalink: product.permalink,
    totalSales: product.total_sales
  };
};

const transformVariation = (variation) => {
  if (!variation) return null;

  return {
    id: variation.id,
    date_created: variation.date_created,
    date_modified: variation.date_modified,
    description: variation.description,
    permalink: variation.permalink,
    sku: variation.sku,
    price: variation.price,
    regular_price: variation.regular_price,
    sale_price: variation.sale_price,
    on_sale: variation.on_sale,
    purchasable: variation.purchasable,
    visible: variation.visible,
    virtual: variation.virtual,
    downloadable: variation.downloadable,
    manage_stock: variation.manage_stock,
    stock_quantity: variation.stock_quantity,
    stock_status: variation.stock_status,
    in_stock: variation.stock_status === 'instock',
    backorders: variation.backorders,
    backorders_allowed: variation.backorders_allowed,
    weight: variation.weight,
    dimensions: variation.dimensions,
    image: variation.image,
    attributes: variation.attributes,
    maxQuantity: variation.manage_stock && variation.stock_quantity !== null 
          ? variation.stock_quantity 
          : 99
  };
};

const transformVariations = (variations) => {
  if (!Array.isArray(variations)) return [];
  return variations.map(transformVariation);
};

const transformProducts = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(transformProduct);
};

const transformProductCard = (product) => {
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    regularPrice: product.regular_price,
    salePrice: product.sale_price,
    onSale: product.on_sale,
    image: product.images?.[0]?.src || null,
    inStock: product.stock_status === 'instock',
    averageRating: product.average_rating,
    ratingCount: product.rating_count,
    featured: product.featured
  };
};

const transformProductCards = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(transformProductCard);
};

const calculateDiscount = (regularPrice, salePrice) => {
  if (!regularPrice || !salePrice) return 0;
  
  const regular = parseFloat(regularPrice);
  const sale = parseFloat(salePrice);
  
  if (regular <= sale) return 0;
  
  return Math.round(((regular - sale) / regular) * 100);
};

const transformProductWithDiscount = (product) => {
  const transformed = transformProduct(product);
  
  if (transformed && transformed.onSale) {
    transformed.discountPercentage = calculateDiscount(
      transformed.regularPrice,
      transformed.salePrice
    );
  }
  
  return transformed;
};

module.exports = {
  transformProduct,
  transformProducts,
  transformVariation,
  transformVariations,
  transformProductCard,
  transformProductCards,
  transformProductWithDiscount,
  calculateDiscount
};