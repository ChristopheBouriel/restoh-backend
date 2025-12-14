const Stripe = require('stripe');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const {
  createInvalidAmountError,
  createPaymentIntentIdRequiredError,
  createPaymentIntentCreationFailedError,
  createPaymentNotCompletedError,
  createPaymentConfirmationFailedError
} = require('../utils/errorHelpers');

// Initialize payment gateway with environment validation
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Fail fast in production if Stripe key is missing
if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  logger.error('FATAL: STRIPE_SECRET_KEY is required in production');
  process.exit(1);
}

// Warn in development if using without key
if (!stripeSecretKey) {
  logger.warn('STRIPE_SECRET_KEY not set - payment endpoints will fail');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;


// @desc    Create Stripe payment intent
// @route   POST /api/payments/stripe/create-intent
// @access  Private
const createStripePaymentIntent = asyncHandler(async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      error: 'Payment service unavailable - Stripe not configured',
      code: 'PAYMENT_SERVICE_UNAVAILABLE'
    });
  }

  const { amount, currency = 'usd' } = req.body;

  if (!amount || amount <= 0) {
    const errorResponse = createInvalidAmountError(amount);
    return res.status(400).json(errorResponse);
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe expects amount in cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    logger.error('Stripe payment intent error', error);
    const errorResponse = createPaymentIntentCreationFailedError(error.message);
    res.status(500).json(errorResponse);
  }
});

// @desc    Confirm Stripe payment
// @route   POST /api/payments/stripe/confirm
// @access  Private
const confirmStripePayment = asyncHandler(async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      error: 'Payment service unavailable - Stripe not configured',
      code: 'PAYMENT_SERVICE_UNAVAILABLE'
    });
  }

  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    const errorResponse = createPaymentIntentIdRequiredError();
    return res.status(400).json(errorResponse);
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      res.status(200).json({
        success: true,
        message: 'Payment confirmed successfully',
        data: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          status: paymentIntent.status,
        },
      });
    } else {
      const errorResponse = createPaymentNotCompletedError(paymentIntent.status);
      res.status(400).json(errorResponse);
    }
  } catch (error) {
    logger.error('Stripe payment confirmation error', error);
    const errorResponse = createPaymentConfirmationFailedError(error.message);
    res.status(500).json(errorResponse);
  }
});


// @desc    Get payment methods
// @route   GET /api/payments/methods
// @access  Private
const getPaymentMethods = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      methods: [
        {
          id: 'stripe',
          name: 'Stripe (Cards)',
          type: 'gateway',
          currencies: ['USD', 'EUR', 'GBP'],
          enabled: true,
        },
        {
          id: 'cod',
          name: 'Cash on Delivery',
          type: 'offline',
          currencies: ['USD', 'EUR', 'GBP'],
          enabled: true,
        },
      ],
    },
  });
});

module.exports = {
  createStripePaymentIntent,
  confirmStripePayment,
  getPaymentMethods,
};