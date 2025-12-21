# RestOh Backend API

Backend API for RestOh Restaurant Web Application - A comprehensive restaurant management system built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Authentication** - Dual token system (Access + Refresh) with role-based access control
- **Menu Management** - CRUD operations for restaurant menu items with reviews & ratings
- **Restaurant Reviews** - Multi-category review system (service, ambiance, food, value)
- **Order Processing** - Complete order lifecycle management
- **Table Reservations** - Booking system with time slot management
- **Payment Integration** - Stripe payment processing + Cash on Delivery
- **Admin Dashboard** - Administrative functions for restaurant management
- **File Uploads** - Cloudinary integration for image storage
- **Reviews & Ratings** - Dual system (menu items + restaurant overall)

## 🛠️ Tech Stack

- **Runtime**: Node.js (>=14.0.0)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + bcryptjs
- **Payment**: Stripe
- **Storage**: Cloudinary (images)
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Joi

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd restoh-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start

   # Debug mode
   npm run dev:debug
   ```

## ⚙️ Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/restoh

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d

# Stripe Payment Gateway
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000
```

## 🗂️ Project Structure

```
├── config/          # Database configuration
├── controllers/     # Business logic handlers
├── middleware/      # Authentication & error handling
├── models/          # MongoDB schemas
├── routes/          # API endpoint definitions
├── utils/           # Utility functions & helpers
└── server.js        # Main application entry point
```

## 🌟 Reviews & Ratings Architecture

The application uses an **embedded document** approach for reviews, following MongoDB and RESTful API best practices (2024):

### Design Decisions

**Embedded vs Separate Collection**:
- ✅ Reviews are embedded within MenuItem documents
- ✅ Provides better read performance (1 query vs 2)
- ✅ Strong parent-child relationship
- ✅ Realistic bounds (~1000 reviews per item)

**Nested vs Flat Routes**:
- **Nested** (`/api/menu/:id/review`) - For creation and collection listing
- **Flat** (`/api/review/:id`) - For individual operations (update, delete)
- Avoids redundant validation and prevents overly nested URLs

### Features (Menu Items)
- One review per user per menu item
- Automatic rating calculation (average & count)
- Nested user object with id and name (no populate/transform needed)
- Direct schema-to-API structure for better performance
- Authorization checks (users can only modify their own reviews)

## 🏪 Restaurant Reviews & Ratings

The application includes a separate review system for the restaurant itself (not menu items).

### Multi-category Rating System

**Progressive design** allows simple initial usage with future expansion:

**Categories** (all optional except overall):
- **Overall** ⭐ Required - General experience rating
- **Service** ⭐ Optional - Staff quality and attentiveness
- **Ambiance** ⭐ Optional - Atmosphere and decoration
- **Food** ⭐ Optional - Overall food quality
- **Value** ⭐ Optional - Price-quality ratio

### Evolution Strategy
- **Phase 1**: Use only `overall` rating (simple 1-5 stars)
- **Phase 2**: Enable all 5 categories for detailed feedback
- **No migration needed**: Optional fields are null until activated

### Features
- One review per user for the restaurant
- Multi-category ratings with automatic aggregation
- Paginated review list for home page display
- Visit date tracking (optional)
- Statistics endpoint with category breakdowns

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration (returns accessToken + refreshToken cookie)
- `POST /api/auth/login` - User login (returns accessToken + refreshToken cookie)
- `POST /api/auth/refresh` - Refresh access token (uses refreshToken cookie)
- `POST /api/auth/logout` - Logout (revokes refresh token)
- `POST /api/auth/logout-all` - Logout from all devices (revokes all refresh tokens)
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `DELETE /api/auth/delete-account` - Delete account (soft delete with safety checks)

### Email
- `GET /api/email/verify/:token` - Verify email address
- `POST /api/email/resend-verification` - Resend verification email
- `POST /api/email/forgot-password` - Request password reset
- `POST /api/email/reset-password/:token` - Reset password with token

### Menu
- `GET /api/menu` - Get all menu items (with filters & pagination)
- `GET /api/menu/:id` - Get single menu item
- `GET /api/menu/popular` - Get popular menu items (auto-calculated)
- `GET /api/menu/suggestions` - Get restaurant suggestions
- `POST /api/menu` - Create menu item (Admin)
- `PUT /api/menu/:id` - Update menu item (Admin)
- `DELETE /api/menu/:id` - Delete menu item (Admin)

### Menu Reviews & Ratings
- `POST /api/menu/:id/review` - Add review to menu item (Authenticated)
- `GET /api/menu/:id/review` - Get all reviews for a menu item
- `GET /api/menu/:id/rating` - Get rating statistics for a menu item
- `PUT /api/review/:reviewId` - Update own review (Authenticated)
- `DELETE /api/review/:reviewId` - Delete own review (Authenticated)

### Restaurant Reviews & Ratings
- `POST /api/restaurant/review` - Add restaurant review (Authenticated)
- `GET /api/restaurant/reviews` - Get all restaurant reviews (paginated)
- `GET /api/restaurant/rating` - Get restaurant rating statistics
- `PUT /api/restaurant/review/:id` - Update own restaurant review (Authenticated)
- `DELETE /api/restaurant/review/:id` - Delete own restaurant review (Authenticated)

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order (requires verified email)
- `GET /api/orders/:id` - Get specific order
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/orders/admin` - Get all orders (Admin)
- `GET /api/orders/admin/recent` - Get recent orders (Admin)
- `GET /api/orders/admin/history` - Get historical orders (Admin)
- `GET /api/orders/stats` - Get order statistics (Admin)
- `PATCH /api/orders/:id/status` - Update order status (Admin)
- `DELETE /api/orders/:id/delete` - Hard delete order (Admin)

### Reservations
- `GET /api/reservations` - Get user reservations
- `POST /api/reservations` - Create reservation (requires verified email)
- `PUT /api/reservations/:id` - Update reservation (requires verified email)
- `DELETE /api/reservations/:id` - Cancel reservation
- `GET /api/reservations/admin/recent` - Get recent reservations (Admin)
- `GET /api/reservations/admin/history` - Get historical reservations (Admin)
- `GET /api/reservations/admin/stats` - Get reservation statistics (Admin)
- `PATCH /api/reservations/admin/:id/status` - Update reservation status (Admin)
- `PUT /api/reservations/admin/:id` - Update reservation details (Admin)

### Tables
- `GET /api/tables/availability` - Get table availability for date (Auth)
- `GET /api/tables/available` - Get available tables for date/slot (Auth)
- `GET /api/tables` - Get all tables (Admin)
- `GET /api/tables/:id` - Get single table (Admin)
- `PUT /api/tables/:id` - Update table (Admin)
- `POST /api/tables/initialize` - Initialize default tables (Admin)

### Payments
- `GET /api/payments/methods` - Get available payment methods
- `POST /api/payments/stripe/create-intent` - Create Stripe payment intent
- `POST /api/payments/stripe/confirm` - Confirm Stripe payment

### Admin
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/users/:userId/orders` - Get user's orders
- `GET /api/admin/users/:userId/reservations` - Get user's reservations
- `PATCH /api/admin/menu/:id/popular` - Toggle popular override (returns updated list)
- `PATCH /api/admin/menu/popular/reset` - Reset all popular overrides
- `GET /api/admin/menu/popular` - Get popular override status
- `PATCH /api/admin/menu/:id/suggested` - Toggle suggested status
- `GET /api/admin/menu/suggested` - Get all suggested items

### Users (Admin)
- `GET /api/users` - Get all users
- `GET /api/users/stats` - Get user statistics
- `GET /api/users/admin` - Get admin users only
- `GET /api/users/:id` - Get single user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Contact
- `POST /api/contact` - Submit contact form (rate limited)
- `GET /api/contact/my-messages` - Get user's messages (Auth)
- `PATCH /api/contact/:id/reply` - Reply to message (Auth)
- `PATCH /api/contact/:id/discussion/:discussionId/status` - Mark as read (Auth)
- `GET /api/contact/admin/messages` - Get all messages (Admin)
- `GET /api/contact/admin/messages/deleted` - Get deleted messages (Admin)
- `PATCH /api/contact/admin/messages/:id/status` - Update status (Admin)
- `PATCH /api/contact/admin/messages/:id/restore` - Restore message (Admin)
- `DELETE /api/contact/admin/messages/:id` - Soft delete message (Admin)

### Newsletter (Admin)
- `POST /api/newsletter/send` - Send newsletter
- `POST /api/newsletter/promotion` - Send promotional email
- `GET /api/newsletter/stats` - Get subscription statistics
- `GET /api/newsletter/unsubscribe/newsletter/:userId` - Unsubscribe (Public)
- `GET /api/newsletter/unsubscribe/promotions/:userId` - Unsubscribe promos (Public)

## 🔐 Authentication

The API uses a **dual token system** for secure authentication:

### Token Architecture

| Token | Type | Duration | Storage | Transmission |
|-------|------|----------|---------|--------------|
| **Access Token** | JWT | 15 minutes | Memory (JS variable) | `Authorization: Bearer` header |
| **Refresh Token** | Random string | 7 days | HttpOnly cookie + DB | Automatic (cookie) |

### Why Dual Tokens?

- **Access Token**: Short-lived, limits exposure window if stolen
- **Refresh Token**: Stored in database, can be revoked immediately on logout
- **True logout**: Calling `/logout` invalidates the token server-side

### Authentication Endpoints

```
POST /api/auth/login      → Returns { accessToken, user } + sets refreshToken cookie
POST /api/auth/register   → Returns { accessToken, user } + sets refreshToken cookie
POST /api/auth/refresh    → Returns { accessToken } (uses refresh token cookie)
POST /api/auth/logout     → Revokes refresh token in database
POST /api/auth/logout-all → Revokes ALL user's refresh tokens (all devices)
```

### Error Codes

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `AUTH_TOKEN_EXPIRED` | Access token expired | Call `/api/auth/refresh` |
| `AUTH_NO_REFRESH_TOKEN` | No refresh token cookie | Redirect to login |
| `AUTH_INVALID_REFRESH_TOKEN` | Token revoked/expired | Redirect to login |
| `UNPAID_DELIVERY_ORDERS` | Cannot delete account (pending delivery) | Show message, disable delete |
| `ACTIVE_RESERVATIONS_WARNING` | Has active reservations | Show confirmation modal, resend with `confirmCancelReservations: true` |

### Usage

Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

For frontend integration guide, see [docs/FRONTEND_REFRESH_TOKEN.md](./docs/FRONTEND_REFRESH_TOKEN.md).

**Default Admin Account:**
- Email: `admin@restoh.com`
- Password: `admin123`

## 💳 Payment Integration

The system supports:
- **Stripe** - Credit/debit card payments
- **Cash on Delivery (COD)** - Pay upon delivery

For payment setup instructions, see [PAYMENT_SETUP_GUIDE.md](./PAYMENT_SETUP_GUIDE.md).

## 🗄️ Database

### MongoDB Configuration
Set `MONGODB_URI` in your `.env` file to connect to MongoDB.

### Connection Error Handling
- **Development mode**: Logs warning and continues running if MongoDB is unavailable
- **Production mode**: Exits on database connection failure for data integrity

## 🔒 Security Features (OWASP Top 10 2021 Compliant)

### Authentication & Session Management
- **Dual Token System** - Access Token (15 min) + Refresh Token (7 days, HttpOnly cookie)
- **Token Revocation** - Server-side invalidation on logout (database-backed)
- **Account Lockout** - 5 failed attempts → 30 minute lockout
- **Email Verification** - Enforced for sensitive operations (orders, payments, reviews)
- **Password Hashing** - bcryptjs encryption

### Input Protection
- **Joi Validation** - Schema validation on all endpoints
- **MongoDB Injection Protection** - `mongo-sanitize` middleware on all inputs
- **Request Size Limits** - 100kb max to prevent DoS attacks

### HTTP Security
- **Helmet.js** - Comprehensive security headers:
  - `Strict-Transport-Security` (HSTS) in production
  - `Content-Security-Policy` (CSP)
  - `X-Frame-Options: DENY` (clickjacking protection)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **CORS** - Environment-aware (strict in production, permissive in development)

### Rate Limiting (Production Only)
| Endpoint | Limit | Purpose |
|----------|-------|---------|
| `/api/auth/register` | 5/15min | Prevent account spam |
| `/api/auth/login` | 10/15min | Brute-force protection |
| `/api/payments/*` | 30/15min | Payment abuse prevention |
| `/api/admin/*` | 30/15min | Admin endpoint protection |
| All `/api/*` | 100/15min | General API protection |
| `POST /api/contact` | 3/hour | Contact form spam |

### Error Handling
- **Safe Logging** - Automatic sensitive data redaction
- **Environment-Aware** - Stack traces only in development
- **Generic Messages** - No sensitive info in production errors

## 📡 API Response Format

All endpoints return consistent JSON responses:

```json
{
  "success": boolean,
  "message": "Response message",
  "data": {} // Response data
}
```

## 🚨 Error Handling

The API includes comprehensive error handling:
- **Global Error Handler** - Catches all unhandled errors
- **Async Wrapper** - Handles async/await errors
- **Custom Error Classes** - Structured error responses
- **Validation Errors** - Detailed field-level validation

## 📋 Development

### Prerequisites
- Node.js >= 14.0.0
- npm or yarn
- MongoDB (optional - uses JSON fallback)

### Development Workflow
1. Make changes to the code
2. The server auto-restarts with nodemon
3. Test endpoints with your preferred API client
4. Check logs for any errors

### Testing
Use tools like Postman, Insomnia, or curl to test API endpoints.

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

RestOh Team

---

For detailed development guidance, see [CLAUDE.md](./CLAUDE.md).