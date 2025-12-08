const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const reservationRoutes = require('../../routes/reservations');
const errorHandler = require('../../middleware/errorHandler');
const Reservation = require('../../models/Reservation');
const {
  createTestUser,
  createTestAdmin,
  createTestTable,
  createTestReservation,
  getFutureDate,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/reservations', reservationRoutes);
app.use(errorHandler);

describe('Reservation Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
  let table1;
  let table2;

  beforeEach(async () => {
    user = await createTestUser({ email: 'resauser@example.com' });
    admin = await createTestAdmin({ email: 'resaadmin@example.com' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
    // Create test tables with varied capacities
    // Validation rule: table capacity must be <= guests + 1
    table1 = await createTestTable({ tableNumber: 1, capacity: 2 }); // For 1-2 guests
    table2 = await createTestTable({ tableNumber: 2, capacity: 4 }); // For 3-4 guests
  });

  describe('POST /api/reservations', () => {
    it('should create reservation with valid data', async () => {
      const reservationData = {
        date: getFutureDate(3).toISOString(),
        slot: 12,
        guests: 2,
        tableNumber: [1],
        contactPhone: '0612345678',
      };

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reservationData)
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Reservation created successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.guests).toBe(2);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should create reservation with special request', async () => {
      const reservationData = {
        date: getFutureDate(3).toISOString(),
        slot: 13,
        guests: 3, // Use 3 guests for table with capacity 4
        tableNumber: [2], // Table 2 has capacity 4, valid for 3-4 guests
        contactPhone: '0612345678',
        specialRequest: 'Window seat please',
      };

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reservationData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.specialRequest).toBe('Window seat please');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/reservations')
        .send({
          date: getFutureDate(3).toISOString(),
          slot: 12,
          guests: 2,
          tableNumber: [1],
          contactPhone: '0612345678',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with past date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          date: pastDate.toISOString(),
          slot: 12,
          guests: 2,
          tableNumber: [1],
          contactPhone: '0612345678',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid phone number', async () => {
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          date: getFutureDate(3).toISOString(),
          slot: 12,
          guests: 2,
          tableNumber: [1],
          contactPhone: '123', // Invalid phone
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with guests exceeding limit', async () => {
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          date: getFutureDate(3).toISOString(),
          slot: 12,
          guests: 25, // Exceeds max 20
          tableNumber: [1],
          contactPhone: '0612345678',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          date: getFutureDate(3).toISOString(),
          // Missing slot, guests, tableNumber, contactPhone
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations', () => {
    beforeEach(async () => {
      // Create some reservations for the user
      await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(3),
      });
      await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'completed',
        date: getFutureDate(-5), // Past reservation
        slot: 14,
      });
    });

    it('should get user reservations', async () => {
      const res = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should filter reservations by status', async () => {
      const res = await request(app)
        .get('/api/reservations?status=confirmed')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('confirmed');
    });

    it('should paginate reservations', async () => {
      const res = await request(app)
        .get('/api/reservations?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reservations')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/reservations/:id', () => {
    let reservation;

    beforeEach(async () => {
      // Create reservation with table 2 (capacity 4) for flexibility in updates
      reservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(5), // Far enough in the future to allow modification
        tableNumber: [2], // Table 2 has capacity 4
        guests: 3,
      });
    });

    it('should update own reservation', async () => {
      const res = await request(app)
        .put(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          guests: 4, // Valid for table with capacity 4
          specialRequest: 'Birthday celebration',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.guests).toBe(4);
      expect(res.body.data.specialRequest).toBe('Birthday celebration');
    });

    it('should fail to update other user reservation', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherReservation = await createTestReservation({
        userId: otherUser._id,
        userEmail: otherUser.email,
        userName: otherUser.name,
        date: getFutureDate(6), // Different date to avoid conflicts
        tableNumber: [1], // Different table
        guests: 2,
        slot: 14, // Different slot
      });

      const res = await request(app)
        .put(`/api/reservations/${otherReservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ specialRequest: 'Update attempt' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail to update non-confirmed reservation', async () => {
      const cancelledReservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'cancelled',
        date: getFutureDate(7), // Different date to avoid conflicts
        slot: 15, // Different slot
        tableNumber: [1], // Different table
        guests: 2,
      });

      const res = await request(app)
        .put(`/api/reservations/${cancelledReservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ specialRequest: 'Update attempt' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Only confirmed reservations');
    });

    it('should return 404 for non-existent reservation', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/reservations/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ guests: 4 })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/reservations/:id (Cancel)', () => {
    it('should cancel confirmed reservation', async () => {
      const reservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(5), // Far enough to allow cancellation
      });

      const res = await request(app)
        .delete(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Reservation cancelled successfully');
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should fail to cancel already cancelled reservation', async () => {
      const reservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'cancelled',
        date: getFutureDate(5),
        slot: 16,
      });

      const res = await request(app)
        .delete(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail to cancel completed reservation', async () => {
      const reservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'completed',
        date: getFutureDate(-5), // Past
        slot: 17,
      });

      const res = await request(app)
        .delete(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail to cancel other user reservation', async () => {
      const otherUser = await createTestUser({ email: 'another@example.com' });
      const reservation = await createTestReservation({
        userId: otherUser._id,
        userEmail: otherUser.email,
        userName: otherUser.name,
        status: 'confirmed',
        date: getFutureDate(5),
        slot: 18,
      });

      const res = await request(app)
        .delete(`/api/reservations/${reservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent reservation', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/reservations/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/reservations/admin/:id/status', () => {
    let reservation;

    beforeEach(async () => {
      reservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(0), // Today for status change tests
      });
    });

    it('should update reservation status as admin', async () => {
      // Create a reservation that's happening now for seated status
      const nowReservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: new Date(), // Today
        slot: new Date().getHours(), // Current hour slot
      });

      const res = await request(app)
        .patch(`/api/reservations/admin/${nowReservation._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'seated' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('seated');
    });

    it('should fail to update status as regular user', async () => {
      const res = await request(app)
        .patch(`/api/reservations/admin/${reservation._id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'seated' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid status', async () => {
      const res = await request(app)
        .patch(`/api/reservations/admin/${reservation._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail without status in body', async () => {
      const res = await request(app)
        .patch(`/api/reservations/admin/${reservation._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Status is required');
    });

    it('should return 404 for non-existent reservation', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/reservations/admin/${fakeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations/admin/recent', () => {
    beforeEach(async () => {
      await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(2),
      });
      await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'completed',
        date: getFutureDate(-3),
        slot: 19,
      });
    });

    it('should get recent reservations as admin', async () => {
      const res = await request(app)
        .get('/api/reservations/admin/recent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/reservations/admin/recent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations/admin/stats', () => {
    beforeEach(async () => {
      await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(1),
      });
      await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'completed',
        date: getFutureDate(-2),
        slot: 20,
      });
    });

    it('should get reservation stats as admin', async () => {
      const res = await request(app)
        .get('/api/reservations/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalReservations).toBeGreaterThanOrEqual(2);
      expect(res.body.data.reservationsByStatus).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/reservations/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/reservations/admin/:id', () => {
    let reservation;

    beforeEach(async () => {
      // Create reservation with 3 guests so we can assign table 2 (capacity 4)
      reservation = await createTestReservation({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        status: 'confirmed',
        date: getFutureDate(3),
        tableNumber: [1],
        guests: 3, // Table 2 (capacity 4) is valid for 3-4 guests
      });
    });

    it('should update reservation as admin', async () => {
      const res = await request(app)
        .put(`/api/reservations/admin/${reservation._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'confirmed',
          tableNumber: [2], // Capacity 4 is valid for 3 guests
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tableNumber).toContain(2);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .put(`/api/reservations/admin/${reservation._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'confirmed' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid status', async () => {
      const res = await request(app)
        .put(`/api/reservations/admin/${reservation._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent reservation', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/reservations/admin/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations/admin/history', () => {
    it('should require date range', async () => {
      const res = await request(app)
        .get('/api/reservations/admin/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('startDate and endDate are required');
    });

    it('should get historical reservations with valid date range', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const res = await request(app)
        .get(`/api/reservations/admin/history?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const res = await request(app)
        .get(`/api/reservations/admin/history?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
