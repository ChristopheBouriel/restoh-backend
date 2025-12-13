const express = require('express');
const {
  createStripePaymentIntent,
  confirmStripePayment,
  getPaymentMethods,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { moderateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All payment routes require authentication and moderate rate limiting
router.use(protect);
router.use(moderateLimiter);

// Payment methods
router.get('/methods', getPaymentMethods);

// Stripe routes
router.post('/stripe/create-intent', createStripePaymentIntent);
router.post('/stripe/confirm', confirmStripePayment);

module.exports = router;