# RestOh Backend - Architecture

> REST API for restaurant management built with Node.js + Express + MongoDB
> Serves the RestOh frontend with HTTP-only cookie authentication

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js >= 14.0.0 |
| **Framework** | Express 4.18 |
| **Database** | MongoDB 7.5 + Mongoose ODM |
| **Authentication** | JWT (dual token system) + bcryptjs |
| **Validation** | Joi |
| **Payments** | Stripe |
| **Email** | Brevo (Sendinblue) |
| **File Storage** | Cloudinary + Multer |
| **Security** | Helmet, CORS, express-rate-limit, mongo-sanitize |
| **Testing** | Jest + Supertest + mongodb-memory-server (422 tests, 84% coverage) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Frontend)                        │
│                    React + Axios + HTTP-only cookies             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                           ROUTES                                 │
│    /api/auth, /api/menu, /api/orders, /api/reservations, ...    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MIDDLEWARE                               │
│    auth.js, rateLimiter.js, mongoSanitize.js, errorHandler.js   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CONTROLLERS                               │
│    Business logic, request handling, response formatting        │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│          MODELS           │   │           SERVICES              │
│   Mongoose schemas        │   │   Email, external APIs          │
│   Data validation         │   │   Business logic helpers        │
└───────────────┬───────────┘   └─────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│         MONGODB           │
│   Collections & indexes   │
└───────────────────────────┘
```

---

## Directory Structure

```
├── config/
│   └── database.js              # MongoDB connection + graceful handling
│
├── constants/
│   ├── errorCodes.js            # Centralized error codes
│   └── global.js                # Global constants
│
├── controllers/                 # Request handlers (business logic)
│   ├── authController.js        # Register, login, logout, profile, delete account
│   ├── emailController.js       # Email verification, password reset
│   ├── menuController.js        # Menu CRUD + reviews endpoints
│   ├── reviewController.js      # Individual review operations
│   ├── restaurantReviewController.js  # Restaurant-level reviews
│   ├── orderController.js       # Order lifecycle management
│   ├── reservationController.js # Table booking system
│   ├── tableController.js       # Table availability
│   ├── paymentController.js     # Stripe integration
│   ├── userController.js        # User management (admin)
│   ├── adminController.js       # Dashboard stats, popular items
│   ├── contactController.js     # Contact form & messaging
│   └── newsletterController.js  # Newsletter & promotions
│
├── middleware/
│   ├── auth.js                  # JWT verification + role-based access
│   ├── rateLimiter.js           # Multi-tier rate limiting
│   ├── mongoSanitize.js         # NoSQL injection protection
│   ├── cloudinaryUpload.js      # Image upload handling
│   └── errorHandler.js          # Global error handling
│
├── models/                      # Mongoose schemas
│   ├── User.js                  # User accounts + preferences
│   ├── MenuItem.js              # Menu items + embedded reviews
│   ├── Order.js                 # Orders with items + payment status
│   ├── Reservation.js           # Table bookings + time slots
│   ├── Table.js                 # Restaurant tables
│   ├── RestaurantReview.js      # Restaurant-level reviews (separate collection)
│   ├── Contact.js               # Contact messages + discussions
│   ├── RefreshToken.js          # Revocable refresh tokens
│   ├── EmailVerification.js     # Email verification tokens (24h)
│   └── PasswordReset.js         # Password reset tokens (30min)
│
├── routes/                      # API endpoint definitions
│   ├── auth.js                  # /api/auth/*
│   ├── emailRoutes.js           # /api/email/*
│   ├── menu.js                  # /api/menu/*
│   ├── review.js                # /api/review/*
│   ├── restaurant.js            # /api/restaurant/*
│   ├── orders.js                # /api/orders/*
│   ├── reservations.js          # /api/reservations/*
│   ├── tables.js                # /api/tables/*
│   ├── payments.js              # /api/payments/*
│   ├── users.js                 # /api/users/*
│   ├── admin.js                 # /api/admin/*
│   ├── contact.js               # /api/contact/*
│   └── newsletterRoutes.js      # /api/newsletter/*
│
├── services/
│   └── email/
│       ├── brevoConfig.js       # Brevo API configuration
│       ├── emailService.js      # Email sending functions
│       └── templates/           # HTML email templates
│           ├── verification.html
│           ├── passwordReset.html
│           ├── newsletter.html
│           └── promotion.html
│
├── utils/
│   ├── asyncHandler.js          # Async error wrapper
│   ├── errorResponse.js         # Custom error class
│   ├── errorHelpers.js          # Error factory functions
│   ├── validation.js            # Joi schemas
│   ├── tokenUtils.js            # JWT + refresh token helpers
│   ├── authCookies.js           # Cookie configuration
│   ├── logger.js                # Safe logging (PII redaction)
│   ├── dashboardStatsHelper.js  # Admin stats aggregation
│   ├── popularItemsHelper.js    # Popular items algorithm
│   ├── reservationHelpers.js    # Reservation logic
│   └── timeSlots.js             # Time slot definitions
│
├── tests/
│   ├── integration/             # API endpoint tests (14 suites)
│   │   ├── authRoutes.test.js
│   │   ├── refreshToken.test.js
│   │   ├── emailVerificationEnforcement.test.js
│   │   ├── menuRoutes.test.js
│   │   ├── reviewRoutes.test.js
│   │   ├── restaurantReviewRoutes.test.js
│   │   ├── orderRoutes.test.js
│   │   ├── reservationRoutes.test.js
│   │   ├── paymentRoutes.test.js
│   │   ├── contactRoutes.test.js
│   │   ├── tableRoutes.test.js
│   │   ├── userRoutes.test.js
│   │   ├── adminRoutes.test.js
│   │   └── emailRoutes.test.js
│   ├── unit/
│   │   └── rateLimiter.test.js
│   └── helpers/
│       └── testHelpers.js       # User factories, token generators
│
├── docs/                        # Additional documentation
│   ├── PAYMENT_SETUP_GUIDE.md
│   ├── EMAIL_SYSTEM.md
│   ├── FRONTEND_EMAIL_VERIFICATION.md
│   ├── DASHBOARD_STATS_API.md
│   └── POPULAR_ITEMS_SUGGESTIONS_PLAN.md
│
└── server.js                    # Application entry point
```

---

## Key Patterns

### 1. Request Flow

All requests follow the same pipeline:

```
Request → Rate Limiter → Auth Middleware → Controller → Response
                ↓               ↓              ↓
           mongoSanitize    Validation    Error Handler
```

### 2. Controller Pattern

Controllers handle business logic with consistent structure:

```javascript
// Example: menuController.js
const getMenuItem = asyncHandler(async (req, res) => {
  // 1. Validate input
  const { error } = menuItemIdSchema.validate(req.params);
  if (error) {
    return res.status(400).json(createValidationError(error.details[0].message));
  }

  // 2. Query database
  const item = await MenuItem.findById(req.params.id);
  if (!item) {
    return res.status(404).json(createMenuItemNotFoundError(req.params.id));
  }

  // 3. Return consistent response
  res.status(200).json({
    success: true,
    data: item
  });
});
```

### 3. Middleware Chain

```javascript
// Route definition example
router.post('/:id/review',
  protect,                    // 1. Verify JWT
  requireVerifiedEmail,       // 2. Check email verification
  addReview                   // 3. Handle request
);

router.get('/:id',
  // No middleware = public endpoint
  getMenuItem
);
```

### 4. Error Handling

Centralized error handling with factory functions:

```javascript
// utils/errorHelpers.js
const createMenuItemNotFoundError = (id) => ({
  success: false,
  error: `Menu item not found: ${id}`,
  code: 'MENU_ITEM_NOT_FOUND'
});

// Usage in controller
return res.status(404).json(createMenuItemNotFoundError(id));
```

### 5. Validation Pattern

Joi schemas for all inputs:

```javascript
// utils/validation.js
const menuItemSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().max(500),
  price: Joi.number().required().min(0),
  category: Joi.string().valid('appetizer', 'main', 'dessert', 'beverage'),
  preparationTime: Joi.number().min(0).max(120)
});

// Usage
const { error } = menuItemSchema.validate(req.body);
```

---

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐
│   Login     │────▶│   Backend   │────▶│       Response          │
│   Request   │     │  validates  │     │                         │
└─────────────┘     └─────────────┘     └─────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────┐
                    │                               │               │
                    ▼                               ▼               ▼
            ┌──────────────┐             ┌──────────────┐   ┌──────────────┐
            │ accessToken  │             │ refreshToken │   │    user      │
            │  (15 min)    │             │   (7 days)   │   │   object     │
            │  in body     │             │  HttpOnly    │   │   in body    │
            └──────────────┘             │  cookie + DB │   └──────────────┘
                    │                    └──────────────┘
                    ▼
            Authorization: Bearer <token>
            (sent with every API request)
```

**Token Refresh Flow**:
```
1. Request with expired access token
2. Backend returns 401 + AUTH_TOKEN_EXPIRED
3. Frontend calls POST /api/auth/refresh (cookie sent automatically)
4. Backend validates refresh token in DB
5. Returns new access token
6. Frontend retries original request
```

**True Logout**:
```
1. POST /api/auth/logout
2. Refresh token deleted from DB (not just cookie)
3. Token cannot be reused even if cookie is restored
```

---

## Data Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  role: 'user' | 'admin',
  address: { street, city, zipCode },
  isEmailVerified: Boolean,
  loginAttempts: Number,
  lockUntil: Date,
  notifications: { newsletter, promotions },
  isDeleted: Boolean  // Soft delete
}
```

### MenuItem (with embedded reviews)
```javascript
{
  name: String,
  description: String,
  price: Number,
  category: 'appetizer' | 'main' | 'dessert' | 'beverage',
  image: String (Cloudinary URL),
  isAvailable: Boolean,
  preparationTime: Number,
  orderCount: Number,       // For popularity calculation
  isPopularOverride: Boolean,
  isSuggested: Boolean,
  reviews: [{               // Embedded array
    user: { id, name },
    rating: 1-5,
    comment: String,
    createdAt: Date
  }],
  rating: {                 // Auto-calculated
    average: Number,
    count: Number
  }
}
```

### Order
```javascript
{
  user: ObjectId,
  items: [{ menuItem, quantity, price }],
  totalPrice: Number,
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled',
  paymentMethod: 'card' | 'cash',
  paymentStatus: 'pending' | 'paid' | 'refunded',
  orderType: 'pickup' | 'delivery',
  deliveryAddress: Object,
  stripePaymentIntentId: String
}
```

### Reservation
```javascript
{
  user: ObjectId,
  date: Date,
  timeSlot: String,
  partySize: Number,
  tables: [ObjectId],
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no-show',
  specialRequests: String
}
```

### RestaurantReview (separate collection)
```javascript
{
  user: { id, name },
  ratings: {
    overall: Number (required),
    service: Number | null,
    ambiance: Number | null,
    food: Number | null,
    value: Number | null
  },
  comment: String,
  visitDate: Date
}
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Create account |
| POST | `/api/auth/login` | - | Login |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | Bearer | Revoke refresh token |
| POST | `/api/auth/logout-all` | Bearer | Logout all devices |
| GET | `/api/auth/me` | Bearer | Get current user |
| PUT | `/api/auth/profile` | Bearer | Update profile |
| DELETE | `/api/auth/delete-account` | Bearer | Soft delete account |

### Menu & Reviews
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/menu` | - | List menu items |
| GET | `/api/menu/:id` | - | Get menu item |
| GET | `/api/menu/popular` | - | Get popular items |
| GET | `/api/menu/suggestions` | - | Get suggestions |
| POST | `/api/menu` | Admin | Create item |
| PUT | `/api/menu/:id` | Admin | Update item |
| DELETE | `/api/menu/:id` | Admin | Delete item |
| POST | `/api/menu/:id/review` | Bearer* | Add review |
| GET | `/api/menu/:id/review` | - | List reviews |
| PUT | `/api/review/:id` | Bearer | Update own review |
| DELETE | `/api/review/:id` | Bearer | Delete own review |

*Requires verified email

### Orders & Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/orders` | Bearer | User's orders |
| POST | `/api/orders` | Bearer* | Create order |
| DELETE | `/api/orders/:id` | Bearer | Cancel order |
| GET | `/api/payments/methods` | - | Available methods |
| POST | `/api/payments/stripe/create-intent` | Bearer* | Create payment |
| POST | `/api/payments/stripe/confirm` | Bearer* | Confirm payment |

### Reservations & Tables
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reservations` | Bearer | User's reservations |
| POST | `/api/reservations` | Bearer* | Create reservation |
| PUT | `/api/reservations/:id` | Bearer* | Update reservation |
| DELETE | `/api/reservations/:id` | Bearer | Cancel reservation |
| GET | `/api/tables/availability` | Bearer | Check availability |
| GET | `/api/tables/available` | Bearer | Available tables |

---

## Business Logic

### Order Status Flow
```
pending → confirmed → preparing → ready → delivered
       ↘ cancelled
```

### Reservation Status Flow
```
confirmed → seated → completed
         ↘ cancelled
         ↘ no-show
```

### Popular Items Algorithm
```javascript
// Computed dynamically, not stored
1. Query items by orderCount (most ordered)
2. Apply category distribution:
   - 2 appetizers
   - 3 mains
   - 1 dessert
   - 2 beverages
3. Exclude items with isPopularOverride: true
4. Return top 8 items
```

### Account Deletion Flow
```
1. Check for unpaid delivery orders → Block deletion
2. Check for active reservations → Require confirmation
3. Anonymize user data (email, name, phone, address)
4. Anonymize related orders/reservations/contacts
5. Cancel active reservations
6. Revoke all refresh tokens
```

---

## Security

### Rate Limiting (Production)
| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/register` | 5 | 15 min |
| `/api/auth/login` | 10 | 15 min |
| `/api/payments/*` | 30 | 15 min |
| `/api/admin/*` | 30 | 15 min |
| `POST /api/contact` | 3 | 1 hour |
| All `/api/*` | 100 | 15 min |

### Security Headers (Helmet.js)
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Input Protection
- Joi validation on all inputs
- mongo-sanitize middleware (NoSQL injection)
- Request size limit: 100kb

### Account Lockout
- 5 failed login attempts → 30 minute lockout
- Progressive delay on subsequent attempts

---

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│  Integration Tests (Jest + Supertest)                           │
│  14 test suites - Full request/response cycle                   │
│  mongodb-memory-server for isolation                            │
├─────────────────────────────────────────────────────────────────┤
│  Unit Tests (Jest)                                              │
│  Isolated component testing (rateLimiter, etc.)                 │
├─────────────────────────────────────────────────────────────────┤
│  Static Analysis (ESLint)                                       │
└─────────────────────────────────────────────────────────────────┘

Coverage: 84% | Tests: 422 | Controllers: 87% | Utils: 80%
```

**Why Integration-First?**
- Tests full middleware chain (auth, validation, error handling)
- Catches real bugs (not just unit logic errors)
- Stable tests (behavior, not implementation)
- High confidence for REST APIs

---

## Environment Variables

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

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Email (Brevo)
BREVO_API_KEY=your-brevo-key

# Frontend
CLIENT_URL=http://localhost:3000
```

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [README.md](../README.md) - Quick start guide
- [PAYMENT_SETUP_GUIDE.md](./PAYMENT_SETUP_GUIDE.md) - Stripe configuration
- [EMAIL_SYSTEM.md](./EMAIL_SYSTEM.md) - Brevo setup
- [DASHBOARD_STATS_API.md](./DASHBOARD_STATS_API.md) - Admin statistics
