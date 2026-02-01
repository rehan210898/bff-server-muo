# Changelog

All notable changes to the MakeupOcean BFF Server will be documented in this file.

## [1.1.0] - 2026-02-01

### Added
- **Razorpay Payment Verification**: Secure payment signature verification endpoint (`POST /payment/verify`)
- **Razorpay Webhooks**: Webhook handler for payment status updates (`POST /payment/webhook`)
- **Payment Status Endpoint**: Check payment status for orders (`GET /payment/status/:order_id`)
- **Refund Endpoint**: Initiate refunds via Razorpay (`POST /payment/refund`)
- **Google Token Exchange**: Mobile OAuth token exchange endpoint (`POST /auth/google/token`)
- **Upstash Redis Support**: Production-grade distributed caching with Redis (optional)
- **Cache Pattern Deletion**: Delete cache keys by pattern

### Changed
- **Cache System**: Refactored to support both Upstash Redis and NodeCache with automatic fallback
- **WooCommerce Client**: Updated to use async cache operations
- **Health Endpoints**: Added cache type indicator and improved stats

### Security
- Payment signature verification using HMAC-SHA256
- Order status validation before payment processing
- Webhook signature verification for Razorpay events
- Improved logging for payment operations

### Configuration
New environment variables:
- `RAZORPAY_WEBHOOK_SECRET` - Razorpay webhook signature verification
- `UPSTASH_REDIS_URL` - Upstash Redis REST URL (optional)
- `UPSTASH_REDIS_TOKEN` - Upstash Redis token (optional)

## [1.0.0] - Initial Release

### Features
- WooCommerce REST API integration
- JWT authentication with 7-day expiration
- Google OAuth integration
- Email verification for registration
- Product, Category, Order, Customer endpoints
- Cart validation and calculation
- Razorpay order creation
- In-memory caching with NodeCache
- Rate limiting (global and per-user)
- Comprehensive error handling
