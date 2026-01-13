const transformOrder = (order) => {
  if (!order) return null;

  return {
    id: order.id,
    customer_id: order.customer_id, // Added customer_id
    status: order.status,
    currency: order.currency,
    date_created: order.date_created, // Keep snake_case for frontend compatibility if it relies on it, or update frontend
    dateCreated: order.date_created,
    total: order.total,
    subtotal: order.total_line_items_quantity, 
    line_items: order.line_items?.map(item => ({ // Frontend uses line_items (snake)
      id: item.id,
      name: item.name,
      product_id: item.product_id || item.productId,
      variation_id: item.variation_id || item.variationId,
      quantity: item.quantity,
      subtotal: item.subtotal,
      total: item.total,
      sku: item.sku,
      image: item.image?.src || null
    })) || [],
    billing: {
      first_name: order.billing?.first_name, // Support snake_case for frontend
      firstName: order.billing?.first_name,
      last_name: order.billing?.last_name,
      lastName: order.billing?.last_name,
      address_1: order.billing?.address_1,
      address1: order.billing?.address_1,
      city: order.billing?.city,
      state: order.billing?.state,
      postcode: order.billing?.postcode,
      country: order.billing?.country,
      email: order.billing?.email,
      phone: order.billing?.phone
    },
    shipping: {
      first_name: order.shipping?.first_name,
      firstName: order.shipping?.first_name,
      last_name: order.shipping?.last_name,
      lastName: order.shipping?.last_name,
      address_1: order.shipping?.address_1,
      address1: order.shipping?.address_1,
      city: order.shipping?.city,
      state: order.shipping?.state,
      postcode: order.shipping?.postcode,
      country: order.shipping?.country
    },
    payment_method_title: order.payment_method_title,
    paymentMethod: order.payment_method_title,
    transaction_id: order.transaction_id,
    transactionId: order.transaction_id,
    shipping_lines: order.shipping_lines || [],
    fee_lines: order.fee_lines || [],
    coupon_lines: order.coupon_lines?.map(coupon => ({
        id: coupon.id,
        code: coupon.code,
        discount: coupon.discount,
        discount_tax: coupon.discount_tax
    })) || [],
    discount_total: order.discount_total,
    total_discount: order.discount_total, // Alias for easier usage
    total_tax: order.total_tax,
    refunds: order.refunds || []
  };
};

const transformOrders = (orders) => {
  if (!Array.isArray(orders)) return [];
  return orders.map(transformOrder);
};

module.exports = {
  transformOrder,
  transformOrders
};