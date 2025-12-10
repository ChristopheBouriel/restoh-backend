const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const tableRoutes = require('../../routes/tables');
const errorHandler = require('../../middleware/errorHandler');
const Table = require('../../models/Table');
const {
  createTestUser,
  createTestAdmin,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/tables', tableRoutes);
app.use(errorHandler);

// Helper to create test tables
const createTestTables = async (count = 5) => {
  const tables = [];
  for (let i = 1; i <= count; i++) {
    tables.push({
      tableNumber: i,
      capacity: i <= 3 ? 4 : 6,
      isActive: true,
      tableBookings: [],
    });
  }
  await Table.insertMany(tables);
  return await Table.find().sort({ tableNumber: 1 });
};

describe('Table Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;

  beforeEach(async () => {
    user = await createTestUser({ email: 'tableuser@example.com' });
    admin = await createTestAdmin({ email: 'tableadmin@example.com' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
  });

  describe('GET /api/tables (Admin only)', () => {
    beforeEach(async () => {
      await createTestTables(5);
    });

    it('should get all tables as admin', async () => {
      const res = await request(app)
        .get('/api/tables')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(5);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.data[0].tableNumber).toBe(1);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/tables')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/tables')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/tables/availability', () => {
    beforeEach(async () => {
      await createTestTables(5);
    });

    it('should get table availability for a date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/tables/availability?date=${dateStr}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.date).toBe(dateStr);
    });

    it('should fail without date parameter', async () => {
      const res = await request(app)
        .get('/api/tables/availability')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DATE_REQUIRED');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/tables/availability?date=2025-12-15')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/tables/available', () => {
    beforeEach(async () => {
      await createTestTables(5);
    });

    it('should get available tables for date and slot', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/tables/available?date=${dateStr}&slot=5&capacity=4`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.availableTables).toBeDefined();
      expect(res.body.data.occupiedTables).toBeDefined();
      expect(res.body.data.notEligibleTables).toBeDefined();
    });

    it('should fail without date parameter', async () => {
      const res = await request(app)
        .get('/api/tables/available?slot=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DATE_AND_SLOT_REQUIRED');
    });

    it('should fail without slot parameter', async () => {
      const res = await request(app)
        .get('/api/tables/available?date=2025-12-15')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DATE_AND_SLOT_REQUIRED');
    });

    it('should fail with invalid slot number (too high)', async () => {
      const res = await request(app)
        .get('/api/tables/available?date=2025-12-15&slot=20')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_SLOT_NUMBER');
    });

    it('should fail with invalid slot number (too low)', async () => {
      const res = await request(app)
        .get('/api/tables/available?date=2025-12-15&slot=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_SLOT_NUMBER');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/tables/available?date=2025-12-15&slot=5')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/tables/:id (Admin only)', () => {
    let table;

    beforeEach(async () => {
      const tables = await createTestTables(3);
      table = tables[0];
    });

    it('should get single table as admin', async () => {
      const res = await request(app)
        .get(`/api/tables/${table._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tableNumber).toBe(1);
    });

    it('should return 404 for non-existent table', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/tables/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TABLE_NOT_FOUND');
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get(`/api/tables/${table._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/tables/:id (Admin only)', () => {
    let table;

    beforeEach(async () => {
      const tables = await createTestTables(3);
      table = tables[0];
    });

    it('should update table capacity as admin', async () => {
      const res = await request(app)
        .put(`/api/tables/${table._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacity: 8 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.capacity).toBe(8);
    });

    it('should update table notes as admin', async () => {
      const res = await request(app)
        .put(`/api/tables/${table._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Near window' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBe('Near window');
    });

    it('should deactivate table as admin', async () => {
      const res = await request(app)
        .put(`/api/tables/${table._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent table', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/tables/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacity: 6 })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TABLE_NOT_FOUND');
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .put(`/api/tables/${table._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ capacity: 8 })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/tables/initialize (Admin only)', () => {
    it('should initialize tables as admin', async () => {
      const res = await request(app)
        .post('/api/tables/initialize')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('initialized');
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .post('/api/tables/initialize')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/tables/initialize')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // Note: POST /api/tables/:id/bookings and DELETE /api/tables/:id/bookings
  // are intentionally disabled in the routes file (commented out).
  // These functions are used internally by reservationController.
  // The addBookingToTable and removeBookingFromTable functions are tested
  // indirectly through reservation tests.
});
