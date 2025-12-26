<div align="center">

# RestOh Backend API

A production-ready REST API for restaurant management, built with Node.js, Express, and MongoDB.

[![Node.js](https://img.shields.io/badge/Node.js->=14.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.5-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Coverage](https://img.shields.io/badge/Coverage-84%25-brightgreen)](tests/)
[![Tests](https://img.shields.io/badge/Tests-422-blue)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Features](#-features) · [Quick Start](#-quick-start) · [API Reference](#-api-reference) · [Architecture](#-architecture) · [Testing](#-testing)

</div>

---

## Overview

RestOh is a comprehensive backend solution for restaurant operations. It handles everything from menu management and order processing to table reservations and customer reviews — with enterprise-grade security and a clean, well-documented API.

**Built for real-world use**: dual-token authentication, OWASP-compliant security, Stripe payments, and a flexible review system designed to evolve with your needs.

---

## ✨ Features

### Core Functionality

| Feature | Description |
|---------|-------------|
| **Menu Management** | Full CRUD with categories, pricing, availability, and embedded reviews |
| **Order Processing** | Complete lifecycle from cart to delivery, with real-time status updates |
| **Table Reservations** | Time-slot booking system with availability checking |
| **Dual Review System** | Separate ratings for menu items and overall restaurant experience |
| **Payment Processing** | Stripe integration + Cash on Delivery option |
| **Admin Dashboard** | Statistics, user management, and content moderation |

### Security & Authentication

| Feature | Implementation |
|---------|----------------|
| **Dual Token System** | Short-lived access tokens (15min) + revocable refresh tokens (7 days) |
| **True Logout** | Server-side token invalidation — not just cookie deletion |
| **Account Lockout** | 5 failed attempts → 30 minute lockout |
| **Input Validation** | Joi schemas on all endpoints + MongoDB injection protection |
| **Rate Limiting** | Tiered limits per endpoint type (auth, payments, general) |
| **Security Headers** | Helmet.js with HSTS, CSP, X-Frame-Options |

### Developer Experience

- **Graceful degradation** — runs without MongoDB in development mode
- **Consistent API responses** — standardized `{ success, message, data }` format
- **Comprehensive error codes** — frontend-friendly error handling
- **Hot reload** — nodemon for development
- **84% test coverage** — integration tests with isolated MongoDB instances

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 14.0.0
- MongoDB (optional for development)
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/restoh-backend.git
cd restoh-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev
```

The API will be available at `http://localhost:3001`

### Available Scripts

```bash
npm run dev           # Development with hot reload
npm run dev:debug     # Development with Node.js inspector
npm start             # Production mode
npm test              # Run test suite
npm run test:coverage # Tests with coverage report
npm run test:watch    # Watch mode for TDD
```

---

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/restoh

# Authentication
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Stripe (see docs/PAYMENT_SETUP_GUIDE.md)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Cloudinary (image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Email - Brevo (see docs/EMAIL_SYSTEM.md)
BREVO_API_KEY=your-brevo-key

# Frontend URL
CLIENT_URL=http://localhost:3000
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Create account | Public |
| `POST` | `/api/auth/login` | Login (returns tokens) | Public |
| `POST` | `/api/auth/refresh` | Refresh access token | Cookie |
| `POST` | `/api/auth/logout` | Revoke refresh token | Bearer |
| `POST` | `/api/auth/logout-all` | Logout all devices | Bearer |
| `GET` | `/api/auth/me` | Get current user | Bearer |
| `PUT` | `/api/auth/profile` | Update profile | Bearer |
| `DELETE` | `/api/auth/delete-account` | Soft delete account | Bearer |

### Menu

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/menu` | List items (filterable, paginated) | Public |
| `GET` | `/api/menu/:id` | Get single item | Public |
| `GET` | `/api/menu/popular` | Auto-calculated popular items | Public |
| `GET` | `/api/menu/suggestions` | Admin-curated suggestions | Public |
| `POST` | `/api/menu` | Create item | Admin |
| `PUT` | `/api/menu/:id` | Update item | Admin |
| `DELETE` | `/api/menu/:id` | Delete item | Admin |

### Reviews

**Menu Item Reviews** (embedded in menu items):

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/menu/:id/review` | Add review | Bearer |
| `GET` | `/api/menu/:id/review` | List reviews | Public |
| `GET` | `/api/menu/:id/rating` | Get rating stats | Public |
| `PUT` | `/api/review/:reviewId` | Update own review | Bearer |
| `DELETE` | `/api/review/:reviewId` | Delete own review | Bearer |

**Restaurant Reviews** (multi-category):

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/restaurant/review` | Add review | Bearer |
| `GET` | `/api/restaurant/reviews` | List reviews (paginated) | Public |
| `GET` | `/api/restaurant/rating` | Stats by category | Public |
| `PUT` | `/api/restaurant/review/:id` | Update own review | Bearer |
| `DELETE` | `/api/restaurant/review/:id` | Delete own review | Bearer |

### Orders & Reservations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/orders` | User's orders | Bearer |
| `POST` | `/api/orders` | Create order | Bearer* |
| `GET` | `/api/reservations` | User's reservations | Bearer |
| `POST` | `/api/reservations` | Create reservation | Bearer* |

*Requires verified email — see [Email Verification Guide](docs/FRONTEND_EMAIL_VERIFICATION.md)

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/payments/methods` | Available methods | Public |
| `POST` | `/api/payments/stripe/create-intent` | Create payment intent | Bearer |
| `POST` | `/api/payments/stripe/confirm` | Confirm payment | Bearer |

For Stripe setup instructions, see [Payment Setup Guide](docs/PAYMENT_SETUP_GUIDE.md).

<details>
<summary><strong>View all endpoints (Admin, Contact, Newsletter, Tables)</strong></summary>

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Dashboard statistics |
| `PATCH` | `/api/admin/menu/:id/popular` | Toggle popular override |
| `PATCH` | `/api/admin/menu/:id/suggested` | Toggle suggestion |
| `GET` | `/api/users` | List all users |
| `DELETE` | `/api/users/:id` | Delete user |

For dashboard statistics API details, see [Dashboard Stats API](docs/DASHBOARD_STATS_API.md).

### Contact

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/contact` | Submit form | Public |
| `GET` | `/api/contact/my-messages` | User's messages | Bearer |
| `PATCH` | `/api/contact/:id/reply` | Reply to thread | Bearer |
| `GET` | `/api/contact/admin/messages` | All messages | Admin |
| `DELETE` | `/api/contact/admin/messages/:id` | Soft delete | Admin |

### Newsletter

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/newsletter/send` | Send newsletter | Admin |
| `POST` | `/api/newsletter/promotion` | Send promo | Admin |
| `GET` | `/api/newsletter/unsubscribe/:type/:userId` | Unsubscribe | Public |

### Tables

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/tables/availability` | Check availability | Bearer |
| `GET` | `/api/tables/available` | Available for slot | Bearer |
| `GET` | `/api/tables` | All tables | Admin |
| `PUT` | `/api/tables/:id` | Update table | Admin |

</details>

---

## 🏗️ Architecture

### Project Structure

```
├── config/           # Database configuration
├── controllers/      # Request handlers (business logic)
├── middleware/       # Auth, validation, error handling
├── models/           # Mongoose schemas
├── routes/           # API route definitions
├── services/         # External services (email, payments)
├── utils/            # Helpers, validators, error classes
├── tests/            # Integration and unit tests
│   ├── integration/  # API endpoint tests (14 suites)
│   ├── unit/         # Isolated component tests
│   └── helpers/      # Test utilities and factories
└── server.js         # Application entry point
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOGIN / REGISTER                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  Returns: accessToken (body)           │
         │           refreshToken (HttpOnly cookie)│
         └────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API REQUESTS                                │
│         Header: Authorization: Bearer <accessToken>              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      Token Valid?                    Token Expired?
         │                                   │
         ▼                                   ▼
   ✓ Process Request              POST /api/auth/refresh
                                  (uses cookie automatically)
                                         │
                                         ▼
                                  New accessToken returned
```

### Review System Design

**Menu Item Reviews** — Embedded documents for optimal read performance:

```javascript
MenuItem {
  name: String,
  reviews: [{           // Embedded array
    user: { id, name },
    rating: 1-5,
    comment: String
  }],
  rating: {             // Auto-calculated
    average: Number,
    count: Number
  }
}
```

**Restaurant Reviews** — Separate collection with progressive multi-category support:

```javascript
RestaurantReview {
  user: { id, name },
  ratings: {
    overall: Number,    // Required (Phase 1)
    service: Number,    // Optional (Phase 2)
    ambiance: Number,
    food: Number,
    value: Number
  },
  comment: String,
  visitDate: Date
}
```

This design allows starting with simple 5-star ratings and expanding to detailed category breakdowns without database migration.

### Popular Items Algorithm

Popular items are **computed dynamically**, not stored:

1. Query items by `orderCount` (most ordered)
2. Apply category distribution: 2 appetizers, 3 mains, 1 dessert, 2 beverages
3. Exclude items with `isPopularOverride: true` (admin exclusions)

This ensures the "Popular" section always reflects actual customer preferences. For implementation details, see [Popular Items & Suggestions Plan](docs/POPULAR_ITEMS_SUGGESTIONS_PLAN.md).

---

## 🧪 Testing

### Philosophy: Integration-First Approach

This project prioritizes **integration tests** over unit tests. Here's why:

| Aspect | Integration Tests | Unit Tests |
|--------|-------------------|------------|
| **Coverage scope** | Full request → response cycle | Single function in isolation |
| **Real bugs caught** | Middleware, auth, validation, DB queries | Logic errors only |
| **Maintenance** | Stable (tests behavior, not implementation) | Brittle (breaks on refactoring) |
| **Confidence** | High (tests what users actually experience) | Medium (mocks can hide issues) |

For a REST API, integration tests provide **better ROI**: they catch authentication bugs, validation errors, database issues, and middleware problems — all in a single test.

### Test Coverage

```
Coverage: 84%
Tests:    422 total (14 integration suites + 1 unit suite)
Lines:    ~7,000 lines of test code
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

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (for TDD)
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests only
npm run test:integration

# Unit tests only
npm run test:unit
```

### Test Structure

```
tests/
├── integration/           # API endpoint tests
│   ├── authRoutes.test.js         # 50+ auth scenarios
│   ├── refreshToken.test.js       # Token rotation tests
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

---

## 🔒 Security

### OWASP Top 10 Compliance

| Risk | Mitigation |
|------|------------|
| **Broken Access Control** | Role-based authorization, ownership checks |
| **Cryptographic Failures** | bcrypt password hashing, secure token generation |
| **Injection** | Joi validation, mongo-sanitize middleware |
| **Security Misconfiguration** | Helmet.js, environment-based settings |
| **Vulnerable Components** | Regular dependency updates |
| **Authentication Failures** | Account lockout, token revocation |
| **Data Integrity Failures** | Input validation, type checking |
| **Logging Failures** | Automatic PII redaction in logs |
| **SSRF** | URL validation, restricted outbound requests |

### Rate Limiting (Production)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/register` | 5 requests | 15 min |
| `/api/auth/login` | 10 requests | 15 min |
| `/api/payments/*` | 30 requests | 15 min |
| `/api/admin/*` | 30 requests | 15 min |
| `POST /api/contact` | 3 requests | 1 hour |
| All other `/api/*` | 100 requests | 15 min |

---

## 📊 API Response Format

All endpoints return consistent JSON:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

Error responses include actionable codes:

```json
{
  "success": false,
  "error": "Access token expired",
  "code": "AUTH_TOKEN_EXPIRED"
}
```

### Common Error Codes

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| `AUTH_TOKEN_EXPIRED` | Access token expired | Call `/api/auth/refresh` |
| `AUTH_NO_REFRESH_TOKEN` | No refresh cookie | Redirect to login |
| `AUTH_INVALID_REFRESH_TOKEN` | Token revoked | Redirect to login |
| `AUTH_EMAIL_NOT_VERIFIED` | Email unverified | Show verification prompt |
| `VALIDATION_ERROR` | Invalid input | Display field errors |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Show retry message |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB + Mongoose |
| **Authentication** | JWT + bcrypt |
| **Validation** | Joi |
| **Payments** | Stripe |
| **Email** | Brevo (Sendinblue) |
| **File Storage** | Cloudinary |
| **Security** | Helmet, CORS, express-rate-limit |
| **Testing** | Jest, Supertest, mongodb-memory-server |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [**Project Architecture**](docs/PROJECT_ARCHITECTURE.md) | **Complete architecture guide** — patterns, data models, flows |
| [Payment Setup Guide](docs/PAYMENT_SETUP_GUIDE.md) | Stripe configuration for test and production |
| [Email System](docs/EMAIL_SYSTEM.md) | Brevo setup, templates, and email architecture |
| [Email Verification](docs/FRONTEND_EMAIL_VERIFICATION.md) | Frontend integration for email verification flow |
| [Dashboard Stats API](docs/DASHBOARD_STATS_API.md) | Admin dashboard statistics endpoint reference |
| [Popular Items Plan](docs/POPULAR_ITEMS_SUGGESTIONS_PLAN.md) | Algorithm and admin override system |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[Back to top](#restoh-backend-api)**

</div>
