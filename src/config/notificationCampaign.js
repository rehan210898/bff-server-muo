// Configure your notification campaign here
// After updating this file, restart the server (if needed) or just hit the trigger endpoint.
// Trigger Endpoint: POST /api/v1/notifications/broadcast

module.exports = {
  // Title of the notification
  title: "Special Offer! 💄",
  
  // Body text of the notification
  body: "Get 20% off on all lipsticks today! Tap to shop now.",
  
  // Optional image (supported on Android and some iOS contexts)
  image: "",
  
  // Data payload for navigation logic in the app
  // Supported screen values: Category, ProductList, ProductDetail, OrderTracking, Home
  // "Category" maps to ProductList screen with categoryId + name params
  data: {
    screen: "Category",
    params: {
      categoryId: 9099,
      name: "Lips"
    }
  },
  
  // Safety switch - set to true to enable sending
  enabled: true
};
