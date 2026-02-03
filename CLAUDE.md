# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **restOh-back**, a Node.js/Express backend API for the RestOh Restaurant Web Application. It provides comprehensive restaurant management features including menu management, order processing, reservations, user authentication, and payment integration.

## Development Commands

### Core Development
- **Start server**: `npm start` (production) or `npm run dev` (development with nodemon)
- **Debug mode**: `npm run dev:debug` (with Node.js inspector)
- **Environment**: Requires Node.js >=14.0.0

### Testing
- **Run all tests**: `npm test`
- **Watch mode**: `npm run test:watch`
- **Coverage report**: `npm run test:coverage`
- **Integration tests only**: `npm run test:integration`
- **Unit tests only**: `npm run test:unit`

### Database Setup
The application uses MongoDB for data persistence:
- **With MongoDB**: Set `MONGODB_URI` in .env file for persistent storage
- **Without MongoDB**: Application handles connection failures gracefully and continues running (development mode)

## Architecture Overview

### Project Structure
```
├── config/           # Database configuration
├── controllers/      # Business logic handlers
├── middleware/       # Authentication & error handling
├── models/           # MongoDB schemas (Mongoose)
├── routes/           # API endpoint definitions
├── services/         # External services (email, payments)
│   └── email/        # Brevo email service + templates
├── utils/            # Utility functions and helpers
├── tests/            # Test suites
│   ├── integration/  # API endpoint tests (14 suites)
│   ├── unit/         # Isolated component tests
│   └── helpers/      # Test utilities and factories
└── server.js         # Main application entry point
```

### Key Architectural Patterns

#### Database Architecture
The application uses MongoDB with Mongoose ODM:
- **Connection handling**: Graceful error management in `config/database.js`
- **Development mode**: Continues running if MongoDB is unavailable
- **Production mode**: Exits on database connection failure

#### Authentication & Authorization
- **Dual Token System** (Access Token + Refresh Token):
  - **Access Token**: Short-lived JWT (15 min) sent in `Authorization: Bearer` header
  - **Refresh Token**: Long-lived token (7 days) stored in HttpOnly cookie + database
- JWT-based authentication with `middleware/auth.js`
- Role-based access control (admin/user roles)
- Email verification enforcement for sensitive operations
- Token revocation on logout (stored in `RefreshToken` collection)
- Supports temporary in-memory storage for development without database

**Authentication Endpoints**:
```
POST /api/auth/login         → Returns { accessToken, user } + sets refreshToken cookie
POST /api/auth/register      → Returns { accessToken, user } + sets refreshToken cookie
POST /api/auth/refresh       → Returns { accessToken } using refresh token cookie
POST /api/auth/logout        → Revokes refresh token in DB
POST /api/auth/logout-all    → Revokes ALL user's refresh tokens (all devices)
DELETE /api/auth/delete-account → Soft delete user account (see Account Deletion below)
```

**Error Codes for Frontend**:
- `AUTH_TOKEN_EXPIRED` → Call `/api/auth/refresh` to get new access token
- `AUTH_NO_REFRESH_TOKEN` → Redirect to login
- `AUTH_INVALID_REFRESH_TOKEN` → Redirect to login
- `AUTH_EMAIL_NOT_VERIFIED` → Show email verification prompt

#### Account Deletion

The `DELETE /api/auth/delete-account` endpoint performs a soft delete with safety checks:

**Blocking conditions** (deletion refused):
- `UNPAID_CASH_ORDERS` → User has unpaid cash orders in preparation, ready, or out-for-delivery status. Restaurant has committed resources, user must wait for delivery and payment collection.

**Warning conditions** (requires confirmation):
- `ACTIVE_RESERVATIONS_WARNING` → User has active reservations (confirmed/seated)
  - First call without body → Returns warning + reservation details
  - Second call with `{ "confirmCancelReservations": true }` → Cancels reservations and deletes account

**On deletion**:
- User data anonymized (name, email, phone, address set to null/deleted-{id}@account.com)
- Orders/Reservations/Contacts data anonymized but preserved for history
- Active reservations cancelled (if confirmed by user)
- Refresh tokens revoked

#### API Structure
All endpoints follow `/api/{resource}` pattern:
- `/api/auth` - Authentication (login, register, profile, account deletion)
- `/api/email` - Email verification & password reset
- `/api/menu` - Menu management + nested reviews endpoints
- `/api/review` - Individual menu review operations (update, delete)
- `/api/restaurant` - Restaurant reviews + rating statistics
- `/api/orders` - Order processing (user & admin)
- `/api/reservations` - Table reservations (user & admin)
- `/api/tables` - Table management & availability
- `/api/payments` - Payment processing (Stripe)
- `/api/users` - User management (admin)
- `/api/admin` - Administrative functions (stats, popular items, suggestions)
- `/api/contact` - Contact form & messaging system
- `/api/newsletter` - Newsletter & promotions (admin)

#### Reviews & Ratings Architecture

**Data Model**: Reviews are **embedded documents** within MenuItem (not a separate collection)

**Rationale** (aligned with MongoDB best practices 2024):
- ✅ Strong parent-child relationship (reviews belong to menu items)
- ✅ Bounded growth (realistic limit: ~1000 reviews per item)
- ✅ Data locality (improved read performance - 1 query instead of 2)
- ✅ Within MongoDB 16MB document limit (~60,000 reviews possible)

**Route Design Philosophy** (RESTful best practices 2024):

*Nested routes* - When parent context is essential:
```
POST   /api/menu/:menuItemId/review    # Create review (requires parent)
GET    /api/menu/:menuItemId/review    # List reviews (scoped to parent)
GET    /api/menu/:menuItemId/rating    # Get rating stats (parent property)
```

*Flat routes* - For individual resource operations:
```
PUT    /api/review/:reviewId            # Update review (ID is sufficient)
DELETE /api/review/:reviewId            # Delete review (no parent needed)
```

**Benefits of this hybrid approach**:
- Avoids redundant validation (menuItemId ↔ reviewId)
- Simplifies update/delete operations
- Prevents overly nested URLs (max 2 levels)
- Follows "Avoid nesting beyond 2-3 levels" (Stack Overflow, Moesif 2024)

**Schema** (direct structure, no transforms):
```javascript
MenuItem.reviews: [{
  user: {
    id: ObjectId (ref: User),
    name: String
  },
  rating: Number (1-5),
  comment: String (max 500 chars),
  createdAt: Date
}]
MenuItem.rating: {
  average: Number (0-5),
  count: Number
}
```

**Design rationale**: User data is stored as a nested object directly in the schema.
This eliminates the need for `.populate()` calls or `toJSON` transforms, providing
better performance, simpler code, and matches the API response structure exactly.

#### Restaurant Reviews & Ratings Architecture

**Data Model**: Restaurant reviews are stored in a **separate collection** (RestaurantReview)

**Progressive multi-categories design** (Phase 1: simple usage, Phase 2: full features):

**Schema**:
```javascript
RestaurantReview {
  user: {
    id: ObjectId (ref: User),
    name: String
  },
  ratings: {
    overall: Number (1-5) REQUIRED,
    service: Number (1-5) | null OPTIONAL,
    ambiance: Number (1-5) | null OPTIONAL,
    food: Number (1-5) | null OPTIONAL,
    value: Number (1-5) | null OPTIONAL
  },
  comment: String (max 500),
  visitDate: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

**Routes**:
```
POST   /api/restaurant/review           # Add restaurant review (auth)
GET    /api/restaurant/reviews          # List reviews (public, paginated)
GET    /api/restaurant/rating           # Get statistics (all categories)
PUT    /api/restaurant/review/:id       # Update own review (auth)
DELETE /api/restaurant/review/:id       # Delete own review (auth)
```

**Evolution strategy**:
- Phase 1: Frontend uses only `ratings.overall` (simple 1-5 star rating)
- Phase 2: Activate `service`, `ambiance`, `food`, `value` categories
- No database migration needed thanks to nullable optional fields

**Statistics endpoint** returns:
```javascript
{
  totalReviews: Number,
  ratings: {
    overall: { average, count },
    service: { average, count },  // 0 if no data yet
    ambiance: { average, count }, // 0 if no data yet
    food: { average, count },     // 0 if no data yet
    value: { average, count }     // 0 if no data yet
  }
}
```

### Payment Integration
- **Stripe**: Card payments with webhook support
- **COD**: Cash on delivery option
- Test mode configured by default (see docs/PAYMENT_SETUP_GUIDE.md)

### Popular Items & Suggestions System

**Popular Items** (automatic calculation):
- Distribution by category: 2 appetizers, 3 mains, 1 dessert, 2 beverages (8 total)
- Based on `orderCount` (most ordered items)
- `isPopularOverride: true` excludes item from automatic selection
- `isPopular` is a **computed field** (not stored), calculated dynamically

**Admin endpoints** (returns updated `popularItems` list after changes):
```
PATCH /api/admin/menu/:id/popular     → Toggle isPopularOverride
PATCH /api/admin/menu/popular/reset   → Reset all overrides to false
GET   /api/admin/menu/popular         → Get override status
```

**Suggestions** (manual selection by admin):
- `isSuggested: true` marks item as restaurant suggestion
- No limit on number of suggestions

```
PATCH /api/admin/menu/:id/suggested   → Toggle isSuggested
GET   /api/admin/menu/suggested       → Get all suggested items
GET   /api/menu/suggestions           → Public endpoint for suggested items
```

### Security Features (OWASP Top 10 2021 Compliant)

**Authentication & Session**:
- Dual token system (Access Token 15min + Refresh Token 7 days)
- Token revocation on logout (database-backed)
- Account lockout after 5 failed login attempts (30 min)
- Email verification enforcement for sensitive operations
- Password hashing with bcryptjs

**Input Protection**:
- Joi schema validation on all endpoints
- MongoDB injection protection via `mongo-sanitize` middleware
- Request size limits (100kb max) to prevent DoS

**HTTP Security**:
- Helmet.js with comprehensive headers (HSTS, CSP, X-Frame-Options, etc.)
- Environment-aware CORS (strict in production, permissive in dev)
- Rate limiting with multi-level tiers (disabled in development)

**Error Handling**:
- Safe logger utility with automatic sensitive data redaction
- Stack traces only in development mode
- Generic error messages in production

**Rate Limiting Tiers** (production only):
| Endpoint | Limit |
|----------|-------|
| `/api/auth/register` | 5 req/15min |
| `/api/auth/login` | 10 req/15min |
| `/api/payments/*`, `/api/admin/*` | 30 req/15min |
| All `/api/*` routes | 100 req/15min |
| `POST /api/contact` | 3 req/hour |

### Error Handling
- Global error handler in `middleware/errorHandler.js`
- Async wrapper utility in `utils/asyncHandler.js`
- Custom error response utility in `utils/errorResponse.js`

## Testing

### Philosophy: Integration-First Approach

This project prioritizes **integration tests** over unit tests for better ROI on a REST API:

| Aspect | Integration Tests | Unit Tests |
|--------|-------------------|------------|
| **Coverage scope** | Full request → response cycle | Single function in isolation |
| **Real bugs caught** | Middleware, auth, validation, DB queries | Logic errors only |
| **Maintenance** | Stable (tests behavior, not implementation) | Brittle (breaks on refactoring) |
| **Confidence** | High (tests what users actually experience) | Medium (mocks can hide issues) |

### Test Coverage

```
Coverage: 84%
Tests:    422 total (14 integration suites + 1 unit suite)
```

| Category | Coverage | Notes |
|----------|----------|-------|
| **Controllers** | 87% | Business logic fully tested |
| **Utils** | 80% | Helpers and validators |
| **Middleware** | 53% | Auth tested, upload mocked |

### Test Stack

- **Jest** — Test runner with parallel execution
- **Supertest** — HTTP assertions for Express
- **mongodb-memory-server** — Isolated MongoDB instances per test suite

Each test suite spins up its own in-memory MongoDB, ensuring:
- No test pollution between suites
- Parallel execution without conflicts
- No external dependencies required

### Test Structure

```
tests/
├── integration/           # API endpoint tests
│   ├── authRoutes.test.js
│   ├── refreshToken.test.js
│   ├── emailVerificationEnforcement.test.js
│   ├── menuRoutes.test.js
│   ├── reviewRoutes.test.js
│   ├── restaurantReviewRoutes.test.js
│   ├── orderRoutes.test.js
│   ├── reservationRoutes.test.js
│   ├── paymentRoutes.test.js
│   ├── contactRoutes.test.js
│   ├── tableRoutes.test.js
│   ├── userRoutes.test.js
│   ├── adminRoutes.test.js
│   └── emailRoutes.test.js
├── unit/
│   └── rateLimiter.test.js
└── helpers/
    └── testHelpers.js     # User factories, token generators
```

### Writing New Tests

When adding new endpoints or features:

1. **Create integration test** in `tests/integration/{feature}Routes.test.js`
2. **Use test helpers** from `tests/helpers/testHelpers.js`:
   ```javascript
   const { createTestUser, generateAuthToken } = require('../helpers/testHelpers');
   ```
3. **Mock external services** (email, payments) to avoid side effects:
   ```javascript
   jest.mock('../../services/email/emailService', () => ({
     sendVerificationEmail: jest.fn().mockResolvedValue(true),
   }));
   ```
4. **Test both success and error cases** for each endpoint

## Data Models

### Core Entities
- **User**: Authentication, profiles, preferences, addresses
- **MenuItem**: Menu items with categories, pricing, availability, **embedded reviews**
- **Order**: Order processing with items, payment status, delivery
- **Reservation**: Table booking system with time slots
- **RestaurantReview**: Separate collection for restaurant-level reviews

### Reviews Data Model
Reviews are **embedded** within MenuItem documents:
- **One review per user per item** (UNIQUE constraint)
- **Automatic rating calculation** via `calculateAverageRating()` method
- **Nested user object** with id and name (no populate needed)

### User Roles
- **user**: Regular customers (order, reserve, profile management)
- **admin**: Full access to all resources and admin panel

### Contact & Messaging System

**User features**:
- Submit contact form (with optional authentication)
- View own messages history
- Reply to admin messages in discussion thread
- Mark messages as read

**Admin features**:
- View all contact messages (with filters, paginated)
- Update message status (new, in-progress, resolved)
- Reply to user messages
- Soft delete / restore messages

### Newsletter System

**Admin endpoints**:
```
POST /api/newsletter/send       → Send newsletter to subscribers
POST /api/newsletter/promotion  → Send promotional email
GET  /api/newsletter/stats      → Get subscription statistics
```

**Unsubscribe** (public, no auth):
```
GET /api/newsletter/unsubscribe/newsletter/:userId
GET /api/newsletter/unsubscribe/promotions/:userId
```

### Tables Management

**User endpoints** (authenticated):
```
GET /api/tables/availability   → Get table availability for a date
GET /api/tables/available      → Get available tables for date/slot
```

**Admin endpoints**:
```
GET    /api/tables             → Get all tables
GET    /api/tables/:id         → Get single table
PUT    /api/tables/:id         → Update table
POST   /api/tables/initialize  → Initialize default tables
```

## Development Notes

### Environment Configuration
- Copy `.env.example` to `.env` and configure
- Essential variables: `JWT_SECRET`, `JWT_EXPIRE`, `MONGODB_URI`
- Payment gateways: `STRIPE_SECRET_KEY`
- Email service: `BREVO_API_KEY`

### Testing Without Database
- Application automatically handles MongoDB connection failures gracefully
- Continues running in development mode (logs warning)
- Exits in production mode for data integrity

### File Upload Handling
- Cloudinary integration for image storage
- Multer middleware for file uploads
- Avatar uploads for user profiles

### API Response Format
Consistent response structure across all endpoints:
```json
{
  "success": boolean,
  "message": string,
  "data": object/array
}
```

Error responses include actionable codes:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Development Workflow
1. MongoDB is optional - app works with or without it
2. Payment system starts in test mode (no real charges)
3. CORS configured for multiple localhost ports (3000, 3001, 3002)
4. Rate limiting applies only to `/api/` routes (disabled in dev)
5. Run `npm run test:watch` for TDD workflow

## Docker

L'application est containerisée et disponible sur Docker Hub :

```bash
# Image Docker
docker pull cbouriel/restoh-backend:latest

# Build local
docker build -t restoh-backend .
```

**Fichiers Docker :**
- `Dockerfile` : Image Node.js Alpine avec healthcheck
- `.dockerignore` : Exclusions (node_modules, tests, docs, etc.)

### Database Seeding

Scripts de seed disponibles dans `seeds/` :

```bash
# Depuis le container Docker
docker exec restoh-backend node seeds/seed-all.js

# En local
node seeds/seed-all.js
```

**Scripts disponibles :**
- `seed-all.js` : Seed complet (toutes les collections)
- `seed-menu.js`, `seed-users.js`, `seed-tables.js`
- `seed-reservations.js`, `seed-orders.js`, `seed-contacts.js`
- `seed-restaurant-reviews.js`

### Stack complète avec Docker Compose

Repo dédié : `restoh-docker` (https://github.com/cbouriel/restoh-docker)

```bash
git clone https://github.com/cbouriel/restoh-docker.git
cd restoh-docker
docker-compose up -d
docker exec restoh-backend node seeds/seed-all.js
```

**Credentials par défaut :**
- Admin : `admin@restoh.com` / `admin123`
- Demo : `demo@test.com` / `123456`

## Safari/iOS Compatibility

### ITP (Intelligent Tracking Prevention) Workarounds

Safari blocks third-party cookies in cross-origin scenarios. The following workarounds are implemented on the `fix/safari-itp-localstorage-fallback` branch:

**Backend changes:**
- `server.js`: `app.set('trust proxy', 1)` for Render reverse proxy
- `utils/tokenUtils.js` & `utils/authCookies.js`: `sameSite: 'none'` in production
- `controllers/authController.js`: Refresh token also returned in response body (not just cookie)
- Login, refresh, and logout endpoints accept refresh token from request body as fallback

**Email verification double-call handling:**
- `controllers/emailController.js`: Uses `markAsUsed()` instead of `deleteOne()` after verification
- Handles Safari double-calls gracefully (if token already used but user verified → returns success)

## Documentation

Additional documentation in `docs/`:
- `PAYMENT_SETUP_GUIDE.md` - Stripe configuration
- `EMAIL_SYSTEM.md` - Brevo setup and templates
- `FRONTEND_EMAIL_VERIFICATION.md` - Frontend integration guide
- `DASHBOARD_STATS_API.md` - Admin statistics endpoint
- `POPULAR_ITEMS_SUGGESTIONS_PLAN.md` - Algorithm details
- `SESSION_RECAP_2026-01-28_to_02-02.md` - Safari/iOS fixes and session context
- `DEMO_FIXES_RECAP.md` - Fixes to apply to demo project
