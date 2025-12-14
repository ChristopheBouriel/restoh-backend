const express = require('express');
const {
  createStripePaymentIntent,
  confirmStripePayment,
  getPaymentMethods,
} = require('../controllers/paymentController');
const { protect, requireEmailVerified } = require('../middleware/auth');
const { moderateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All payment routes require authentication and moderate rate limiting
router.use(protect);
router.use(moderateLimiter);

// Payment methods (read-only, no email verification required)
router.get('/methods', getPaymentMethods);

// Stripe routes - require verified email for payment operations
router.post('/stripe/create-intent', requireEmailVerified, createStripePaymentIntent);
router.post('/stripe/confirm', requireEmailVerified, confirmStripePayment);

module.exports = router;