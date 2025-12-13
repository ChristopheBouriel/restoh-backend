# Security Remediation Tracker

> **Audit Date**: December 13, 2025
> **Based on**: OWASP Top 10 2021
> **Status**: In Progress

## Overview

| Priority | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 4     | 1     | 3         |
| High     | 5     | 0     | 5         |
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

### 2. [ ] IDOR Vulnerability in Contact Messages

**Location**: `controllers/contactController.js:57-72`

**Issue**: Admin can delete any contact message by ID without validation. While admin-only, a compromised admin account or privilege escalation could allow data destruction.

**Risk**: Mass deletion of contact messages, audit trail destruction.

**Fix**:
```javascript
// Add soft delete instead of hard delete
const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Contact.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      error: 'Message not found',
      code: 'MESSAGE_NOT_FOUND'
    });
  }

  // Soft delete with audit trail
  message.isDeleted = true;
  message.deletedBy = req.user._id;
  message.deletedAt = new Date();
  await message.save();

  res.status(200).json({
    success: true,
    message: 'Contact message archived successfully'
  });
});
```

**Also required**: Add `isDeleted`, `deletedBy`, `deletedAt` fields to Contact model.

---

### 3. [ ] ObjectId Comparison Bug (Authentication Bypass Risk)

**Location**: Multiple controllers

**Issue**: Direct ObjectId comparison using `===` or `!==` can fail silently. ObjectIds must be compared using `.equals()` or `.toString()`.

**Affected Files**:
- `controllers/reviewController.js`
- `controllers/restaurantReviewController.js`
- `controllers/orderController.js`
- `controllers/reservationController.js`

**Example of the bug**:
```javascript
// WRONG - May fail silently
if (review.user.id !== req.user._id) { ... }

// CORRECT
if (!review.user.id.equals(req.user._id)) { ... }
```

**Fix**: Search and replace all ObjectId comparisons:
```bash
# Find all problematic comparisons
grep -rn "\.user.*===\|\.user.*!==" controllers/
```

---

### 4. [ ] Stripe Demo Key Fallback in Production

**Location**: `server.js:28-35`

**Issue**: If `STRIPE_SECRET_KEY` is not set, the app uses a demo key that allows test transactions but could expose the system to abuse.

**Current code**:
```javascript
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key_replace_me';
```

**Fix**:
```javascript
// Fail fast in production if Stripe key is missing
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  console.error('FATAL: STRIPE_SECRET_KEY is required in production');
  process.exit(1);
}

// Only use demo key in development with clear warning
if (!stripeSecretKey) {
  console.warn('⚠️  Using Stripe demo key - payments will not work');
}
```

---

## High Issues

### 5. [ ] Console.log of Sensitive Data

**Location**: Various files

**Issue**: Sensitive information (tokens, user data, payment info) may be logged to console, which could be captured in log aggregators.

**Affected areas**:
- Authentication flows
- Payment processing
- Error handlers

**Fix**:
```javascript
// Create a safe logger utility
// utils/logger.js
const sanitize = (obj) => {
  const sensitive = ['password', 'token', 'secret', 'authorization', 'cookie'];
  const sanitized = { ...obj };

  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
};

const logger = {
  info: (msg, data) => console.log(msg, data ? sanitize(data) : ''),
  error: (msg, data) => console.error(msg, data ? sanitize(data) : ''),
  warn: (msg, data) => console.warn(msg, data ? sanitize(data) : '')
};

module.exports = logger;
```

---

### 6. [ ] Overly Permissive CORS Configuration

**Location**: `server.js:39-47`

**Issue**: CORS allows multiple localhost origins, which is fine for development but risky if left in production.

**Current code**:
```javascript
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  // ...
};
```

**Fix**:
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// In production, require explicit origin configuration
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  console.error('FATAL: ALLOWED_ORIGINS must be set in production');
  process.exit(1);
}
```

**Environment variable**: Add `ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com`

---

### 7. [ ] No Account Lockout After Failed Login Attempts

**Location**: `controllers/authController.js`

**Issue**: No protection against brute-force attacks on user accounts. Attackers can try unlimited password combinations.

**Fix**:
```javascript
// Add to User model
const userSchema = new mongoose.Schema({
  // ... existing fields
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
});

userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// In authController.js login function
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

  // Check if account is locked
  if (user?.isLocked) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return res.status(423).json({
      success: false,
      error: `Account locked. Try again in ${remainingTime} minutes.`,
      code: 'ACCOUNT_LOCKED'
    });
  }

  if (!user || !(await user.matchPassword(password))) {
    // Increment failed attempts
    if (user) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }
      await user.save();
    }
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // Reset on successful login
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  // ... continue with token generation
});
```

---

### 8. [ ] Email Verification Not Enforced

**Location**: `controllers/authController.js`, `models/User.js`

**Issue**: Users can register and immediately access all features without verifying their email. This allows fake accounts and makes account recovery difficult.

**Fix** (multi-step):

**Step 1**: Add email verification fields to User model:
```javascript
emailVerified: { type: Boolean, default: false },
emailVerificationToken: String,
emailVerificationExpires: Date
```

**Step 2**: Generate verification token on registration:
```javascript
const crypto = require('crypto');

// In register function
const verificationToken = crypto.randomBytes(32).toString('hex');
user.emailVerificationToken = crypto
  .createHash('sha256')
  .update(verificationToken)
  .digest('hex');
user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
await user.save();

// Send email with verification link
// await sendVerificationEmail(user.email, verificationToken);
```

**Step 3**: Add verification endpoint:
```javascript
// GET /api/auth/verify-email/:token
const verifyEmail = asyncHandler(async (req, res) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired verification token'
    });
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});
```

**Step 4**: Add middleware to check email verification for sensitive operations.

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
4. Implement soft delete for contact messages

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
