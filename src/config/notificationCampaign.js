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
  data: {
    screen: "Category", // Matches your navigation stack names
    params: {
      categoryId: 9099, // e.g. Lips category
      name: "Lips"
    }
  },
  
  // Safety switch - set to true to enable sending
  enabled: true
};
