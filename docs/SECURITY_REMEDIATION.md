# Security Remediation Tracker

> **Audit Date**: December 13, 2025
> **Based on**: OWASP Top 10 2021
> **Status**: In Progress

## Overview

| Priority | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 4     | 4     | 0         |
| High     | 5     | 4     | 1         |
| Medium   | 8     | 0     | 8         |

---

## Critical Issues

### 1. [x] Rate Limiting Disabled in Development ✅ FIXED

**Location**: `middleware/rateLimiter.js` (new), `server.js:30-31`

**Issue**: Rate limiting was only enabled when `NODE_ENV === 'production'`, leaving development and staging environments unprotected.

**Risk**: DoS attacks, brute-force attacks on login, API abuse.

**Solution Implemented** (December 13, 2025):

Multi-level rate limiting strategy with environment-aware limits:

| Limiter | Production | Development | Applied To |
|---------|------------|-------------|------------|
| `strictLimiter` | 5 req/15min | 50 req/15min | `/api/auth/register` |
| `authLimiter` | 10 req/15min | 100 req/15min | `/api/auth/login` (skips successful) |
| `moderateLimiter` | 30 req/15min | 300 req/15min | `/api/payments/*`, `/api/admin/*` |
| `standardLimiter` | 100 req/15min | 1000 req/15min | All `/api/*` routes (global) |
| `contactLimiter` | 3 req/hour | 30 req/hour | `POST /api/contact` |

**Files modified**:
- `middleware/rateLimiter.js` - New file with all limiters
- `server.js` - Global standard limiter
- `routes/auth.js` - Strict/auth limiters on login/register
- `routes/payments.js` - Moderate limiter
- `routes/admin.js` - Moderate limiter
- `routes/contact.js` - Contact form spam protection

**Tests**: `tests/unit/rateLimiter.test.js` (11 tests, 100% coverage)

---

### 2. [x] IDOR Vulnerability in Contact Messages ✅ FIXED

**Location**: `controllers/contactController.js`, `models/Contact.js`

**Issue**: Admin could hard delete any contact message, destroying data permanently with no audit trail.

**Risk**: Mass deletion of contact messages, audit trail destruction.

**Solution Implemented** (December 13, 2025):

Soft delete with audit trail and restore capability:

**Schema changes** (`models/Contact.js`):
```javascript
isDeleted: { type: Boolean, default: false },
deletedBy: { type: ObjectId, ref: 'User', default: null },
deletedAt: { type: Date, default: null }
```

**New endpoints**:
- `GET /api/contact/admin/messages/deleted` - View archived messages
- `PATCH /api/contact/admin/messages/:id/restore` - Restore archived messages

**Behavior changes**:
- `DELETE /api/contact/admin/messages/:id` now soft deletes (archives)
- All queries exclude soft-deleted documents
- Deleted messages retain full audit trail (who deleted, when)

**Database migration**: Existing documents updated with `isDeleted: false`

**Tests**: 8 new tests covering soft delete, restore, and exclusion from queries

---

### 3. [x] ObjectId Comparison Bug (Authentication Bypass Risk) ✅ FIXED

**Location**: Multiple controllers

**Issue**: Direct ObjectId comparison using `===` or `!==` can fail silently. ObjectIds must be compared using `.equals()` or `.toString()`.

**Solution Implemented** (December 14, 2025):

Replaced all fragile `.toString() !== .toString()` and `===` comparisons with Mongoose's `.equals()` method:

**Files modified**:
- `controllers/reviewController.js` (lines 41, 88)
- `controllers/restaurantReviewController.js` (lines 122, 177)
- `controllers/orderController.js` (lines 198, 304)
- `controllers/reservationController.js` (lines 455, 704)
- `controllers/userController.js` (lines 119, 133, 184)
- `controllers/menuController.js` (line 228)

**Pattern applied**:
```javascript
// BEFORE (fragile)
if (review.user.id.toString() !== req.user._id.toString()) { ... }

// AFTER (robust)
if (!review.user.id.equals(req.user._id)) { ... }
```

**Note**: For comparisons with `req.params.id` (URL string), we use `._id.toString() === req.params.id` since req.params is always a string.

**Tests**: All 395 existing tests pass

---

### 4. [x] Stripe Demo Key Fallback in Production ✅ FIXED

**Location**: `controllers/paymentController.js:11-25`

**Issue**: If `STRIPE_SECRET_KEY` is not set, the app used a demo key that could expose the system to abuse.

**Solution Implemented** (December 14, 2025):

Removed demo key fallback with proper environment validation:

```javascript
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Fail fast in production if Stripe key is missing
if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  console.error('FATAL: STRIPE_SECRET_KEY is required in production');
  process.exit(1);
}

// Warn in development if using without key
if (!stripeSecretKey) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set - payment endpoints will fail');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
```

**Behavior**:
- **Production**: App exits immediately if `STRIPE_SECRET_KEY` is missing
- **Development**: Warning logged, payment endpoints return 503 Service Unavailable
- No more insecure demo key fallback

---

## High Issues

### 5. [x] Console.log of Sensitive Data ✅ FIXED

**Location**: Various files

**Issue**: Sensitive information (tokens, user data, payment info) may be logged to console, which could be captured in log aggregators.

**Solution Implemented** (December 14, 2025):

Created `utils/logger.js` - Safe logging utility with automatic sanitization:

```javascript
const sensitiveKeys = [
  'password', 'token', 'secret', 'authorization', 'cookie',
  'creditcard', 'cardnumber', 'cvv', 'ssn', 'apikey', 'api_key',
  'accesstoken', 'refreshtoken', 'privatekey', 'private_key'
];

const sanitize = (obj, depth = 0) => {
  // Recursively sanitize objects, redacting sensitive fields
};

const logger = {
  info: (msg, data) => isDev && console.log(`[INFO] ${msg}`, sanitize(data)),
  debug: (msg, data) => isDev && console.log(`[DEBUG] ${msg}`, sanitize(data)),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, sanitize(data)),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, sanitize(data)),
  success: (msg, data) => isDev && console.log(`[SUCCESS] ✅ ${msg}`, sanitize(data))
};
```

**Files updated**:
- All controllers (auth, contact, menu, order, payment, reservation, user)
- `middleware/errorHandler.js`
- `middleware/cloudinaryUpload.js`
- `services/email/emailService.js`

**Features**:
- Automatic sanitization of sensitive fields
- `info`, `debug`, `success` only log in development/test mode
- `warn`, `error` always log (in all environments)
- Recursive sanitization for nested objects
- Error stack traces only in development

---

### 6. [x] Overly Permissive CORS Configuration ✅ FIXED

**Location**: `server.js:34-91`

**Issue**: CORS allowed multiple localhost origins in all environments, risky in production.

**Solution Implemented** (December 14, 2025):

Environment-aware CORS configuration with strict production requirements:

```javascript
const isProduction = process.env.NODE_ENV === 'production';

// Production origins from environment variable
const prodOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

// Fail fast in production if ALLOWED_ORIGINS is not set
if (isProduction && prodOrigins.length === 0) {
  logger.error('FATAL: ALLOWED_ORIGINS must be set in production');
  process.exit(1);
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow no-origin requests
    if (isDevelopment) return callback(null, true); // Permissive in dev
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  // ...
};
```

**Behavior**:
- **Development/Test**: All origins allowed for easy testing
- **Production**: Only `ALLOWED_ORIGINS` env var origins permitted
- **Production without ALLOWED_ORIGINS**: App exits immediately

**Environment variable**: `ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com`

---

### 7. [x] No Account Lockout After Failed Login Attempts ✅ FIXED

**Location**: `controllers/authController.js`, `models/User.js`

**Issue**: No protection against brute-force attacks on user accounts. Attackers can try unlimited password combinations.

**Solution Implemented** (December 14, 2025):

**User model changes** (`models/User.js`):
```javascript
// New fields (select: false to hide from normal queries)
loginAttempts: { type: Number, default: 0, select: false },
lockUntil: { type: Date, default: null, select: false }

// Virtual to check lock status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Methods for lockout management
UserSchema.methods.incLoginAttempts = async function() { ... }
UserSchema.methods.resetLoginAttempts = function() { ... }
```

**Login flow changes** (`controllers/authController.js`):
- Check if account is locked before password verification
- Increment attempts on failed login (5 max)
- Lock account for 30 minutes after 5 failures
- Reset attempts on successful login
- Return HTTP 423 (Locked) when account is locked

**Error response**:
```javascript
{
  success: false,
  error: 'Account temporarily locked',
  code: 'AUTH_ACCOUNT_LOCKED',
  details: {
    remainingMinutes: 28,
    suggestion: 'Please try again in 28 minutes.',
    tip: 'If you forgot your password, use the password reset feature.'
  }
}
```

**Tests**: 4 new tests covering lockout scenarios

---

### 8. [x] Email Verification Not Enforced ✅ FIXED

**Location**: `middleware/auth.js`, routes files

**Issue**: Users could register and immediately access all features without verifying their email. The `isEmailVerified` field and email verification endpoints already existed but were not enforced for sensitive operations.

**Solution Implemented** (December 14, 2025):

The email verification system was already in place but not enforced. Added middleware to require verified email for sensitive operations.

**New error code** (`constants/errorCodes.js`):
```javascript
const AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED';
```

**New error helper** (`utils/errorHelpers.js`):
```javascript
const createEmailNotVerifiedError = () => {
  return {
    success: false,
    error: 'Email verification required',
    code: ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED,
    details: {
      message: 'You must verify your email address before performing this action.',
      suggestion: 'Please check your inbox for the verification email, or request a new one.',
      action: 'resend-verification'
    }
  };
};
```

**New middleware** (`middleware/auth.js`):
```javascript
const requireEmailVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    const errorResponse = createEmailNotVerifiedError();
    return res.status(403).json(errorResponse);
  }
  next();
};
```

**Routes updated**:
- `routes/orders.js` - `POST /` (create order)
- `routes/reservations.js` - `POST /`, `PUT /:id` (create/update reservation)
- `routes/payments.js` - `POST /stripe/create-intent`, `POST /stripe/confirm`
- `routes/menu.js` - `POST /:id/review` (add review)
- `routes/review.js` - `PUT /:reviewId`, `DELETE /:reviewId`
- `routes/restaurant.js` - `POST /review`, `PUT /review/:id`, `DELETE /review/:id`

**Read-only operations** (viewing orders, reservations, reviews) remain accessible to unverified users.

**Tests**: 9 new tests in `tests/integration/emailVerificationEnforcement.test.js`

**Frontend impact**: When a 403 with code `AUTH_EMAIL_NOT_VERIFIED` is received, display a message prompting the user to verify their email with a link to resend the verification email.

---

### 9. [ ] JWT Token Not Validated for Expiration Properly

**Location**: `middleware/auth.js`

**Issue**: While JWT expiration is set, there's no token blacklist for logout or compromised tokens. Users who "logout" can still use their token until expiration.

**Fix options**:

**Option A**: Short-lived tokens + refresh tokens:
```javascript
// Generate short access token (15 min) + long refresh token (7 days)
const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });
```

**Option B**: Redis-based token blacklist:
```javascript
// On logout, add token to Redis blacklist
await redis.set(`blacklist:${token}`, '1', 'EX', tokenRemainingTime);

// In auth middleware, check blacklist
const isBlacklisted = await redis.get(`blacklist:${token}`);
if (isBlacklisted) {
  return res.status(401).json({ error: 'Token has been revoked' });
}
```

---

## Medium Issues

### 10. [ ] Weak Password Policy

**Location**: `models/User.js`

**Issue**: Minimum password length is only 6 characters. No requirements for complexity.

**Current**:
```javascript
password: {
  type: String,
  required: true,
  minlength: 6
}
```

**Fix**:
```javascript
// utils/passwordValidator.js
const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// In authController.js register function
const { isValid, errors } = validatePassword(password);
if (!isValid) {
  return res.status(400).json({
    success: false,
    error: 'Password does not meet requirements',
    details: errors,
    code: 'WEAK_PASSWORD'
  });
}
```

---

### 11. [ ] No CSRF Protection

**Location**: Application-wide

**Issue**: No CSRF tokens for state-changing operations. While JWT in headers provides some protection, cookie-based auth scenarios are vulnerable.

**Fix**:
```bash
npm install csurf
```

```javascript
// server.js
const csrf = require('csurf');

// Only for cookie-based auth routes
const csrfProtection = csrf({ cookie: true });

// Apply to routes that use cookies
app.use('/api/auth', csrfProtection, authRoutes);
```

**Note**: If using only Bearer token auth (no cookies), CSRF is less critical but still recommended for defense in depth.

---

### 12. [ ] No Security Audit Logging

**Location**: Application-wide

**Issue**: No logging of security-relevant events (login attempts, password changes, admin actions). Makes incident investigation difficult.

**Fix**:
```javascript
// models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: {
    type: String,
    enum: [
      'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT',
      'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST',
      'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
      'ADMIN_ACTION', 'PERMISSION_DENIED',
      'SUSPICIOUS_ACTIVITY'
    ]
  },
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

// utils/auditLogger.js
const AuditLog = require('../models/AuditLog');

const logSecurityEvent = async (req, action, details = {}) => {
  try {
    await AuditLog.create({
      userId: req.user?._id,
      action,
      details,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

module.exports = { logSecurityEvent };
```

---

### 13. [ ] Missing Input Validation on Some Endpoints

**Location**: Various controllers

**Issue**: Some endpoints lack proper input validation with Joi or similar. Relying only on Mongoose validation is insufficient.

**Example - Missing validation**:
```javascript
// controllers/orderController.js - items array not validated
const createOrder = asyncHandler(async (req, res) => {
  const { items, orderType, ... } = req.body;
  // No validation of items structure
});
```

**Fix**:
```javascript
// validators/orderValidator.js
const Joi = require('joi');

const orderItemSchema = Joi.object({
  menuItem: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  quantity: Joi.number().integer().min(1).max(100).required(),
  specialInstructions: Joi.string().max(500).optional()
});

const createOrderSchema = Joi.object({
  items: Joi.array().items(orderItemSchema).min(1).max(50).required(),
  orderType: Joi.string().valid('pickup', 'delivery').required(),
  deliveryAddress: Joi.when('orderType', {
    is: 'delivery',
    then: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      postalCode: Joi.string().required()
    }).required(),
    otherwise: Joi.forbidden()
  }),
  notes: Joi.string().max(500).optional()
});

module.exports = { createOrderSchema };
```

---

### 14. [ ] No Request Size Limits

**Location**: `server.js`

**Issue**: No explicit limits on request body size. Large payloads could cause memory issues.

**Fix**:
```javascript
// server.js
app.use(express.json({ limit: '10kb' })); // Limit JSON body to 10KB
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

---

### 15. [ ] Sensitive Data in Error Responses

**Location**: `middleware/errorHandler.js`

**Issue**: In development mode, stack traces are returned. Ensure this never happens in production.

**Fix**:
```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  const response = {
    success: false,
    error: err.message || 'Server Error',
    code: err.code || 'INTERNAL_ERROR'
  };

  // NEVER include stack trace in production
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Log full error server-side
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?._id
  });

  res.status(statusCode).json(response);
};
```

---

### 16. [ ] No HTTP Security Headers Verification

**Location**: `server.js`

**Issue**: Helmet.js is used but configuration should be verified for completeness.

**Fix** - Verify these headers are set:
```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
}));
```

---

### 17. [ ] MongoDB Injection Potential

**Location**: Various query operations

**Issue**: While Mongoose provides some protection, certain query patterns could be vulnerable.

**Example of vulnerable pattern**:
```javascript
// Potentially vulnerable if req.query.status is an object like { $ne: null }
const orders = await Order.find({ status: req.query.status });
```

**Fix**:
```javascript
// Always sanitize and validate query parameters
const mongo = require('mongo-sanitize');

// Middleware to sanitize all inputs
app.use((req, res, next) => {
  req.body = mongo(req.body);
  req.query = mongo(req.query);
  req.params = mongo(req.params);
  next();
});

// Or validate explicitly
const status = ['pending', 'confirmed', 'completed', 'cancelled'].includes(req.query.status)
  ? req.query.status
  : undefined;
```

---

## Implementation Priority

### Phase 1: Critical (Week 1)
1. ~~Enable rate limiting in all environments~~ ✅ DONE
2. Fix ObjectId comparison bug
3. Secure Stripe key configuration
4. ~~Implement soft delete for contact messages~~ ✅ DONE

### Phase 2: High (Week 2-3)
5. Add account lockout mechanism
6. Configure production CORS properly
7. Create safe logger utility
8. Implement email verification (can be gradual)

### Phase 3: Medium (Week 4+)
9. Strengthen password policy
10. Add CSRF protection
11. Implement audit logging
12. Add comprehensive input validation
13. Set request size limits
14. Review error responses
15. Verify Helmet configuration
16. Add MongoDB query sanitization

---

## Testing Checklist

After implementing each fix:

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual security testing performed
- [ ] No regressions in existing functionality
- [ ] Documentation updated

---

## Resources

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

## Change Log

| Date | Issue # | Status | Notes |
|------|---------|--------|-------|
| 2025-12-13 | All | Identified | Initial OWASP audit completed |
| 2025-12-13 | #1 | Fixed | Multi-level rate limiting implemented |
| 2025-12-13 | #2 | Fixed | Soft delete with audit trail for contact messages |
| 2025-12-14 | #3 | Fixed | ObjectId comparisons using .equals() |
| 2025-12-14 | #4 | Fixed | Stripe demo key fallback removed |
| 2025-12-14 | #5 | Fixed | Safe logger utility with sanitization |
| 2025-12-14 | #6 | Fixed | Environment-aware CORS configuration |
| 2025-12-14 | #7 | Fixed | Account lockout after 5 failed attempts |
| 2025-12-14 | #8 | Fixed | Email verification enforced for sensitive operations |
