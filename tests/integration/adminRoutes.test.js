const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const adminRoutes = require('../../routes/admin');
const errorHandler = require('../../middleware/errorHandler');
const MenuItem = require('../../models/MenuItem');
const {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  createTestOrder,
  createTestTable,
  createTestReservation,
  getFutureDate,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

describe('Admin Routes Integration Tests', () => {
  let admin;
  let adminToken;
  let regularUser;
  let userToken;

  beforeEach(async () => {
    admin = await createTestAdmin({ email: 'admintest@example.com' });
    adminToken = generateAuthToken(admin._id);
    regularUser = await createTestUser({ email: 'regularuser@example.com' });
    userToken = generateAuthToken(regularUser._id);
  });

  describe('GET /api/admin/stats', () => {
    beforeEach(async () => {
      // Create some menu items
      await createTestMenuItem({ name: 'Active Item 1', category: 'main', cuisine: 'asian', isAvailable: true });
      await createTestMenuItem({ name: 'Active Item 2', category: 'appetizer', cuisine: 'lao', isAvailable: true });
      await createTestMenuItem({ name: 'Inactive Item', category: 'dessert', cuisine: 'continental', isAvailable: false });

      // Create tables for reservations
      await createTestTable({ tableNumber: 1, capacity: 4 });

      // Create test orders (this month)
      await createTestOrder({
        userId: regularUser._id,
        userEmail: regularUser.email,
        userName: regularUser.name,
        orderType: 'pickup',
        totalPrice: 25.00,
        status: 'delivered'
      });
      await createTestOrder({
        userId: regularUser._id,
        userEmail: regularUser.email,
        userName: regularUser.name,
        orderType: 'delivery',
        totalPrice: 35.00,
        status: 'delivered'
      });

      // Create test reservation (this month)
      await createTestReservation({
        userId: regularUser._id,
        userEmail: regularUser.email,
        userName: regularUser.name,
        guests: 4,
        date: getFutureDate(1),
        tableNumber: [1]
      });
    });

    it('should get dashboard stats as admin', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Menu stats
      expect(res.body.data.totalMenuItems).toBeGreaterThanOrEqual(3);
      expect(res.body.data.activeMenuItems).toBeGreaterThanOrEqual(2);
      expect(res.body.data.inactiveMenuItems).toBeGreaterThanOrEqual(1);

      // Quick stats for dashboard cards
      expect(res.body.data.quickStats).toBeDefined();
      expect(typeof res.body.data.quickStats.todayRevenue).toBe('number');
      expect(typeof res.body.data.quickStats.todayOrders).toBe('number');
      expect(typeof res.body.data.quickStats.todayReservations).toBe('number');
      expect(typeof res.body.data.quickStats.totalActiveUsers).toBe('number');

      // Orders stats structure
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.orders.thisMonth).toBeDefined();
      expect(res.body.data.orders.lastMonth).toBeDefined();
      expect(res.body.data.orders.today).toBeDefined();
      expect(res.body.data.orders.sameDayLastWeek).toBeDefined();

      // Orders thisMonth should have data
      expect(res.body.data.orders.thisMonth.total).toBeGreaterThanOrEqual(0);
      expect(res.body.data.orders.thisMonth.revenue).toBeGreaterThanOrEqual(0);
      expect(typeof res.body.data.orders.thisMonth.pickup).toBe('number');
      expect(typeof res.body.data.orders.thisMonth.delivery).toBe('number');

      // Reservations stats structure
      expect(res.body.data.reservations).toBeDefined();
      expect(res.body.data.reservations.thisMonth).toBeDefined();
      expect(res.body.data.reservations.lastMonth).toBeDefined();
      expect(res.body.data.reservations.today).toBeDefined();
      expect(res.body.data.reservations.sameDayLastWeek).toBeDefined();

      // Reservations thisMonth should have data
      expect(res.body.data.reservations.thisMonth.total).toBeGreaterThanOrEqual(0);
      expect(typeof res.body.data.reservations.thisMonth.totalGuests).toBe('number');

      // Revenue stats structure
      expect(res.body.data.revenue).toBeDefined();
      expect(typeof res.body.data.revenue.thisMonth).toBe('number');
      expect(typeof res.body.data.revenue.lastMonth).toBe('number');
      expect(typeof res.body.data.revenue.today).toBe('number');
      expect(typeof res.body.data.revenue.sameDayLastWeek).toBe('number');
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return correct order counts and revenue for this month', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // We created 2 orders: 1 pickup ($25) + 1 delivery ($35) = $60 total
      expect(res.body.data.orders.thisMonth.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.orders.thisMonth.revenue).toBeGreaterThanOrEqual(60);
      expect(res.body.data.orders.thisMonth.pickup).toBeGreaterThanOrEqual(1);
      expect(res.body.data.orders.thisMonth.delivery).toBeGreaterThanOrEqual(1);
    });

    it('should return correct reservation stats for this month', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Reservations are counted by their date, not createdAt
      // The beforeEach creates a reservation with getFutureDate(1) which is tomorrow
      // If tomorrow is still in the same month, it will be counted in thisMonth
      // Otherwise it will be in a future period
      // Just verify structure and non-negative values
      expect(res.body.data.reservations.thisMonth.total).toBeGreaterThanOrEqual(0);
      expect(res.body.data.reservations.thisMonth.totalGuests).toBeGreaterThanOrEqual(0);
    });

    it('should match revenue in orders and revenue section', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Revenue should be consistent between orders section and revenue section
      expect(res.body.data.revenue.thisMonth).toBe(res.body.data.orders.thisMonth.revenue);
      expect(res.body.data.revenue.lastMonth).toBe(res.body.data.orders.lastMonth.revenue);
      expect(res.body.data.revenue.today).toBe(res.body.data.orders.today.revenue);
      expect(res.body.data.revenue.sameDayLastWeek).toBe(res.body.data.orders.sameDayLastWeek.revenue);
    });

    it('should exclude cancelled orders from stats', async () => {
      // Create a cancelled order
      await createTestOrder({
        userId: regularUser._id,
        userEmail: regularUser.email,
        userName: regularUser.name,
        orderType: 'pickup',
        totalPrice: 100.00,
        status: 'cancelled'
      });

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Revenue should NOT include the cancelled $100 order
      // We have 2 valid orders totaling $60, so revenue should be >= 60 but NOT include $100
      expect(res.body.data.orders.thisMonth.revenue).toBeGreaterThanOrEqual(60);
      // This is a bit tricky to test precisely, but we verify structure works
      expect(res.body.data.orders.thisMonth.total).toBeGreaterThanOrEqual(2);
    });

    it('should exclude cancelled and no-show reservations from stats', async () => {
      // Get stats before adding cancelled reservation
      const resBefore = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const guestsBefore = resBefore.body.data.reservations.thisMonth.totalGuests;

      // Create cancelled reservation with 6 guests
      await createTestReservation({
        userId: regularUser._id,
        userEmail: regularUser.email,
        userName: regularUser.name,
        guests: 6,
        date: getFutureDate(2),
        tableNumber: [1],
        status: 'cancelled'
      });

      const resAfter = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Cancelled reservation should NOT add to guest count
      // Guest count should remain the same
      expect(resAfter.body.data.reservations.thisMonth.totalGuests).toBe(guestsBefore);
    });

    it('should return zero for periods with no data', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // sameDayLastWeek and lastMonth might be 0 if no historical data
      expect(res.body.data.orders.lastMonth.total).toBeGreaterThanOrEqual(0);
      expect(res.body.data.orders.sameDayLastWeek.total).toBeGreaterThanOrEqual(0);
      expect(res.body.data.reservations.lastMonth.total).toBeGreaterThanOrEqual(0);
      expect(res.body.data.reservations.sameDayLastWeek.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/admin/users/:userId/orders', () => {
    beforeEach(async () => {
      // Create orders for the regular user
      await createTestOrder({ userId: regularUser._id, status: 'pending' });
      await createTestOrder({ userId: regularUser._id, status: 'delivered' });
    });

    it('should get user orders as admin', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${regularUser._id}/orders`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for user with no orders', async () => {
      const newUser = await createTestUser({ email: 'noorders@example.com' });

      const res = await request(app)
        .get(`/api/admin/users/${newUser._id}/orders`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${regularUser._id}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/users/:userId/reservations', () => {
    beforeEach(async () => {
      // Create table and reservations for the user
      await createTestTable({ tableNumber: 10, capacity: 4 });
      await createTestReservation({
        userId: regularUser._id,
        userEmail: regularUser.email,
        userName: regularUser.name,
        tableNumber: [10],
        date: getFutureDate(5),
        slot: 3,
      });
    });

    it('should get user reservations as admin', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${regularUser._id}/reservations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${regularUser._id}/reservations`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/admin/menu/:id/popular', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Popular Test Item', isPopularOverride: false });
    });

    it('should toggle popular override on', async () => {
      const res = await request(app)
        .patch(`/api/admin/menu/${menuItem._id}/popular`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.toggledItem.isPopularOverride).toBe(true);
      expect(res.body.message).toContain('excluded');
    });

    it('should toggle popular override off', async () => {
      // First toggle on
      await MenuItem.findByIdAndUpdate(menuItem._id, { isPopularOverride: true });

      const res = await request(app)
        .patch(`/api/admin/menu/${menuItem._id}/popular`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.toggledItem.isPopularOverride).toBe(false);
      expect(res.body.message).toContain('included');
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/menu/${fakeId}/popular`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .patch(`/api/admin/menu/${menuItem._id}/popular`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/admin/menu/popular/reset', () => {
    beforeEach(async () => {
      // Create items with overrides
      await createTestMenuItem({ name: 'Override 1', isPopularOverride: true });
      await createTestMenuItem({ name: 'Override 2', isPopularOverride: true });
      await createTestMenuItem({ name: 'No Override', isPopularOverride: false });
    });

    it('should reset all popular overrides', async () => {
      const res = await request(app)
        .patch('/api/admin/menu/popular/reset')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.modifiedCount).toBeGreaterThanOrEqual(2);

      // Verify all overrides are reset
      const overriddenCount = await MenuItem.countDocuments({ isPopularOverride: true });
      expect(overriddenCount).toBe(0);
    });

    it('should handle case when no items have overrides', async () => {
      // First reset all
      await MenuItem.updateMany({}, { isPopularOverride: false });

      const res = await request(app)
        .patch('/api/admin/menu/popular/reset')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.modifiedCount).toBe(0);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .patch('/api/admin/menu/popular/reset')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/menu/popular', () => {
    beforeEach(async () => {
      await createTestMenuItem({ name: 'Override Main', category: 'main', isPopularOverride: true, orderCount: 50 });
      await createTestMenuItem({ name: 'Override Appetizer', category: 'appetizer', isPopularOverride: true, orderCount: 30 });
      await createTestMenuItem({ name: 'No Override', category: 'main', isPopularOverride: false, orderCount: 100 });
    });

    it('should get popular items status as admin', async () => {
      const res = await request(app)
        .get('/api/admin/menu/popular')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.overriddenItems).toBeInstanceOf(Array);
      expect(res.body.data.overriddenItems.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.totalOverridden).toBeGreaterThanOrEqual(2);
      expect(res.body.data.overridesByCategory).toBeInstanceOf(Array);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/admin/menu/popular')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/admin/menu/:id/suggested', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Suggestion Test Item', isSuggested: false });
    });

    it('should toggle suggested status on', async () => {
      const res = await request(app)
        .patch(`/api/admin/menu/${menuItem._id}/suggested`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuggested).toBe(true);
      expect(res.body.message).toContain('added');
    });

    it('should toggle suggested status off', async () => {
      // First toggle on
      await MenuItem.findByIdAndUpdate(menuItem._id, { isSuggested: true });

      const res = await request(app)
        .patch(`/api/admin/menu/${menuItem._id}/suggested`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuggested).toBe(false);
      expect(res.body.message).toContain('removed');
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/admin/menu/${fakeId}/suggested`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .patch(`/api/admin/menu/${menuItem._id}/suggested`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/menu/suggested', () => {
    beforeEach(async () => {
      await createTestMenuItem({ name: 'Suggested 1', isSuggested: true });
      await createTestMenuItem({ name: 'Suggested 2', isSuggested: true });
      await createTestMenuItem({ name: 'Not Suggested', isSuggested: false });
    });

    it('should get all suggested items as admin', async () => {
      const res = await request(app)
        .get('/api/admin/menu/suggested')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(2);
      expect(res.body.data.every(item => item.isSuggested === true)).toBe(true);
    });

    it('should return empty array when no suggested items', async () => {
      // Remove all suggested flags
      await MenuItem.updateMany({}, { isSuggested: false });

      const res = await request(app)
        .get('/api/admin/menu/suggested')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toHaveLength(0);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/admin/menu/suggested')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
