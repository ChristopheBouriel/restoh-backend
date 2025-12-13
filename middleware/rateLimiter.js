const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Configuration
 *
 * Multi-level rate limiting strategy:
 * - Strict: For auth routes (login, register, forgot-password) - prevents brute force
 * - Moderate: For sensitive operations (payments, admin) - prevents abuse
 * - Standard: For general API routes - prevents DoS
 *
 * All limiters are active in all environments, with relaxed limits in development.
 */

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

/**
 * Create a standardized rate limit response
 */
const createRateLimitResponse = (message) => ({
  success: false,
  error: message,
  code: 'RATE_LIMIT_EXCEEDED'
});

/**
 * Standard handler for rate limit exceeded
 */
const rateLimitHandler = (req, res, next, options) => {
  res.status(options.statusCode).json(
    createRateLimitResponse(options.message)
  );
};

/**
 * Strict Rate Limiter
 * For: /api/auth/login, /api/auth/register, /api/auth/forgot-password
 *
 * Production: 5 requests per 15 minutes
 * Development: 50 requests per 15 minutes
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 50 : 5,
  message: 'Too many attempts. Please try again in 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  skipSuccessfulRequests: false, // Count all requests
});

/**
 * Auth Strict Limiter (for login specifically)
 * Slightly more lenient than strictLimiter but still protective
 *
 * Production: 10 requests per 15 minutes
 * Development: 100 requests per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Moderate Rate Limiter
 * For: /api/payments/*, /api/admin/*
 *
 * Production: 30 requests per 15 minutes
 * Development: 300 requests per 15 minutes
 */
const moderateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 300 : 30,
  message: 'Too many requests to this resource. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Standard Rate Limiter
 * For: All other /api/* routes
 *
 * Production: 100 requests per 15 minutes
 * Development: 1000 requests per 15 minutes
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Contact Form Limiter
 * Prevents spam on contact form
 *
 * Production: 3 requests per hour
 * Development: 30 requests per hour
 */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 30 : 3,
  message: 'Too many contact requests. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  strictLimiter,
  authLimiter,
  moderateLimiter,
  standardLimiter,
  contactLimiter
};
