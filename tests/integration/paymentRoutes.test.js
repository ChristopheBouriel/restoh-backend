// Set test Stripe key before loading controller
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const paymentRoutes = require('../../routes/payments');
const errorHandler = require('../../middleware/errorHandler');
const {
  createTestUser,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/payments', paymentRoutes);
app.use(errorHandler);

describe('Payment Routes Integration Tests', () => {
  let user;
  let userToken;

  beforeEach(async () => {
    user = await createTestUser({ email: 'paymentuser@example.com' });
    userToken = generateAuthToken(user._id);
  });

  describe('GET /api/payments/methods', () => {
    it('should get available payment methods', async () => {
      const res = await request(app)
        .get('/api/payments/methods')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.methods).toBeDefined();
      expect(res.body.data.methods).toBeInstanceOf(Array);
      expect(res.body.data.methods.length).toBeGreaterThan(0);

      // Check stripe method exists
      const stripeMethod = res.body.data.methods.find(m => m.id === 'stripe');
      expect(stripeMethod).toBeDefined();
      expect(stripeMethod.enabled).toBe(true);

      // Check COD method exists
      const codMethod = res.body.data.methods.find(m => m.id === 'cod');
      expect(codMethod).toBeDefined();
      expect(codMethod.enabled).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/payments/methods')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/stripe/create-intent', () => {
    it('should create a payment intent', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 25.00, currency: 'usd' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.clientSecret).toBeDefined();
      expect(res.body.data.paymentIntentId).toBeDefined();
    });

    it('should fail with missing amount', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currency: 'usd' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should fail with zero amount', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 0, currency: 'usd' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should fail with negative amount', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: -10, currency: 'usd' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/create-intent')
        .send({ amount: 25.00 })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/stripe/confirm', () => {
    it('should confirm a successful payment', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ paymentIntentId: 'pi_test_123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('confirmed');
      expect(res.body.data.paymentIntentId).toBe('pi_test_123');
      expect(res.body.data.status).toBe('succeeded');
    });

    it('should fail with missing paymentIntentId', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PAYMENT_INTENT_ID_REQUIRED');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/confirm')
        .send({ paymentIntentId: 'pi_test_123' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
