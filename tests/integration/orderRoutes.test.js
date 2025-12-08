const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const orderRoutes = require('../../routes/orders');
const errorHandler = require('../../middleware/errorHandler');
const Order = require('../../models/Order');
const {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  createTestOrder,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/orders', orderRoutes);
app.use(errorHandler);

describe('Order Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
  let menuItem;

  beforeEach(async () => {
    user = await createTestUser({ email: 'orderuser@example.com' });
    admin = await createTestAdmin({ email: 'orderadmin@example.com' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
    menuItem = await createTestMenuItem({ name: 'Test Dish', price: 15.99 });
  });

  describe('POST /api/orders', () => {
    it('should create order with valid data', async () => {
      const orderData = {
        userId: user._id.toString(), // Required by Joi validation
        items: [
          { menuItem: menuItem._id.toString(), quantity: 2 }
        ],
        orderType: 'delivery',
        deliveryAddress: {
          street: '123 Test St',
          city: 'Paris',
          zipCode: '75001'
        },
        phone: '0612345678', // 10 digits
        paymentMethod: 'cash'
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Order created successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.totalPrice).toBe(31.98); // 15.99 * 2
      expect(res.body.data.orderType).toBe('delivery');
      expect(res.body.data.status).toBe('pending');
    });

    it('should create pickup order without delivery address', async () => {
      const orderData = {
        userId: user._id.toString(),
        items: [
          { menuItem: menuItem._id.toString(), quantity: 1 }
        ],
        orderType: 'pickup',
        phone: '0612345678',
        paymentMethod: 'cash'
      };

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderType).toBe('pickup');
      expect(res.body.data.deliveryAddress).toBeNull();
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [{ menuItem: menuItem._id.toString(), quantity: 1 }],
          orderType: 'pickup'
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with empty items', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: user._id.toString(),
          items: [],
          orderType: 'pickup',
          phone: '0612345678'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid order type', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: user._id.toString(),
          items: [{ menuItem: menuItem._id.toString(), quantity: 1 }],
          orderType: 'invalid',
          phone: '0612345678'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail delivery order without address', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: user._id.toString(),
          items: [{ menuItem: menuItem._id.toString(), quantity: 1 }],
          orderType: 'delivery',
          phone: '0612345678'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      // Joi validation returns 'message', not 'error'
      expect(res.body.message || res.body.error).toBeDefined();
    });

    it('should fail with non-existent menu item', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: user._id.toString(),
          items: [{ menuItem: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
          orderType: 'pickup',
          phone: '0612345678'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create some orders for the user
      await createTestOrder({ userId: user._id, status: 'pending' });
      await createTestOrder({ userId: user._id, status: 'delivered' });
    });

    it('should get user orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should filter orders by status', async () => {
      const res = await request(app)
        .get('/api/orders?status=pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('pending');
    });

    it('should paginate orders', async () => {
      const res = await request(app)
        .get('/api/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/orders')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/:id', () => {
    let order;

    beforeEach(async () => {
      order = await createTestOrder({ userId: user._id });
    });

    it('should get single order by ID', async () => {
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Order model transforms _id to id in toJSON
      expect(res.body.data.id).toBe(order._id.toString());
    });

    it('should fail accessing other user order', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherOrder = await createTestOrder({ userId: otherUser._id });

      const res = await request(app)
        .get(`/api/orders/${otherOrder._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should allow admin to access any order', async () => {
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/orders/:id (Cancel)', () => {
    it('should cancel pending order', async () => {
      const order = await createTestOrder({
        userId: user._id,
        status: 'pending',
        paymentStatus: 'pending'
      });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Order cancelled successfully');
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should cancel confirmed order with pending payment', async () => {
      const order = await createTestOrder({
        userId: user._id,
        status: 'confirmed',
        paymentStatus: 'pending'
      });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should fail to cancel paid order', async () => {
      const order = await createTestOrder({
        userId: user._id,
        status: 'pending',
        paymentStatus: 'paid'
      });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail to cancel preparing order', async () => {
      const order = await createTestOrder({
        userId: user._id,
        status: 'preparing',
        paymentStatus: 'pending'
      });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail to cancel delivered order', async () => {
      const order = await createTestOrder({
        userId: user._id,
        status: 'delivered',
        paymentStatus: 'paid'
      });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail to cancel other user order', async () => {
      const otherUser = await createTestUser({ email: 'another@example.com' });
      const order = await createTestOrder({
        userId: otherUser._id,
        status: 'pending',
        paymentStatus: 'pending'
      });

      const res = await request(app)
        .delete(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/orders/:id/status (Admin)', () => {
    let order;

    beforeEach(async () => {
      order = await createTestOrder({ userId: user._id, status: 'pending' });
    });

    it('should update order status as admin', async () => {
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should fail to update status as regular user', async () => {
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'confirmed' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid status', async () => {
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/admin (Admin)', () => {
    beforeEach(async () => {
      await createTestOrder({ userId: user._id, status: 'pending' });
      await createTestOrder({ userId: user._id, status: 'confirmed' });
    });

    it('should get all orders as admin', async () => {
      const res = await request(app)
        .get('/api/orders/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/orders/admin')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/stats (Admin)', () => {
    it('should get order stats as admin', async () => {
      await createTestOrder({ userId: user._id, status: 'delivered', paymentStatus: 'paid' });
      await createTestOrder({ userId: user._id, status: 'pending' });

      const res = await request(app)
        .get('/api/orders/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/orders/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
