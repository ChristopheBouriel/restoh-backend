const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const orderRoutes = require('../../routes/orders');
const reservationRoutes = require('../../routes/reservations');
const menuRoutes = require('../../routes/menu');
const User = require('../../models/User');
const MenuItem = require('../../models/MenuItem');
const Table = require('../../models/Table');
const {
  createTestUser,
  createTestMenuItem,
  createTestTable,
  generateAuthToken,
  getFutureDate,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/orders', orderRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/menu', menuRoutes);

describe('Email Verification Enforcement', () => {
  describe('Orders - Email Verification Required', () => {
    let unverifiedUser;
    let unverifiedToken;
    let verifiedUser;
    let verifiedToken;
    let menuItem;

    beforeEach(async () => {
      // Create unverified user
      unverifiedUser = await createTestUser({
        email: 'unverified@example.com',
        isEmailVerified: false,
      });
      unverifiedToken = generateAuthToken(unverifiedUser._id);

      // Create verified user
      verifiedUser = await createTestUser({
        email: 'verified@example.com',
        isEmailVerified: true,
      });
      verifiedToken = generateAuthToken(verifiedUser._id);

      // Create menu item for orders
      menuItem = await createTestMenuItem({
        name: 'Test Item for Order',
        price: 15.99,
      });
    });

    it('should reject order creation for unverified email user with 403', async () => {
      const orderData = {
        items: [{
          menuItem: menuItem._id,
          name: menuItem.name,
          quantity: 2,
          price: menuItem.price,
        }],
        orderType: 'delivery',
        paymentMethod: 'cash',
        deliveryAddress: {
          street: '123 Test St',
          city: 'Test City',
          zipCode: '75001',
        },
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send(orderData)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
      expect(res.body.details.action).toBe('resend-verification');
    });

    it('should not block verified email user from order creation (passes middleware)', async () => {
      const orderData = {
        items: [{
          menuItem: menuItem._id,
          name: menuItem.name,
          quantity: 1,
          price: menuItem.price,
        }],
        orderType: 'pickup',
        paymentMethod: 'cash',
        phone: '0612345678',
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send(orderData);

      // Should NOT get 403 email not verified error
      expect(res.status).not.toBe(403);
      expect(res.body.code).not.toBe('AUTH_EMAIL_NOT_VERIFIED');
    });

    it('should allow viewing orders for unverified email user', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Reservations - Email Verification Required', () => {
    let unverifiedUser;
    let unverifiedToken;
    let verifiedUser;
    let verifiedToken;
    let table;

    beforeEach(async () => {
      // Create unverified user
      unverifiedUser = await createTestUser({
        email: 'unverified-res@example.com',
        isEmailVerified: false,
      });
      unverifiedToken = generateAuthToken(unverifiedUser._id);

      // Create verified user
      verifiedUser = await createTestUser({
        email: 'verified-res@example.com',
        isEmailVerified: true,
      });
      verifiedToken = generateAuthToken(verifiedUser._id);

      // Create table for reservations (tableNumber must be <= 22)
      table = await createTestTable({
        tableNumber: 15,
        capacity: 4,
      });
    });

    it('should reject reservation creation for unverified email user with 403', async () => {
      const futureDate = getFutureDate(5);
      const reservationData = {
        date: futureDate.toISOString().split('T')[0],
        slot: 12,
        guests: 2,
        tableNumber: [table.tableNumber],
        contactPhone: '0612345678',
      };

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send(reservationData)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
    });

    it('should not block verified email user from reservation creation (passes middleware)', async () => {
      const futureDate = getFutureDate(5);
      const reservationData = {
        date: futureDate.toISOString().split('T')[0],
        slot: 12,
        guests: 2,
        tableNumber: [table.tableNumber],
        contactPhone: '0612345678',
      };

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send(reservationData);

      // Should NOT get 403 email not verified error
      expect(res.status).not.toBe(403);
      expect(res.body.code).not.toBe('AUTH_EMAIL_NOT_VERIFIED');
    });

    it('should allow viewing reservations for unverified email user', async () => {
      const res = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Reviews - Email Verification Required', () => {
    let unverifiedUser;
    let unverifiedToken;
    let verifiedUser;
    let verifiedToken;
    let menuItem;

    beforeEach(async () => {
      // Create unverified user
      unverifiedUser = await createTestUser({
        email: 'unverified-review@example.com',
        isEmailVerified: false,
      });
      unverifiedToken = generateAuthToken(unverifiedUser._id);

      // Create verified user
      verifiedUser = await createTestUser({
        email: 'verified-review@example.com',
        isEmailVerified: true,
      });
      verifiedToken = generateAuthToken(verifiedUser._id);

      // Create menu item for reviews
      menuItem = await createTestMenuItem({
        name: 'Test Item for Review',
        price: 12.99,
      });
    });

    it('should reject review creation for unverified email user with 403', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Great food!',
      };

      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send(reviewData)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
    });

    it('should allow review creation for verified email user', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Excellent!',
      };

      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${verifiedToken}`)
        .send(reviewData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('added successfully');
    });

    it('should allow viewing reviews for unverified email user (public route)', async () => {
      const res = await request(app)
        .get(`/api/menu/${menuItem._id}/review`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
