const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const userRoutes = require('../../routes/users');
const errorHandler = require('../../middleware/errorHandler');
const User = require('../../models/User');
const {
  createTestUser,
  createTestAdmin,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', userRoutes);
app.use(errorHandler);

describe('User Routes Integration Tests (Admin)', () => {
  let admin;
  let adminToken;
  let regularUser;
  let userToken;

  beforeEach(async () => {
    admin = await createTestAdmin({ email: 'useradmin@example.com' });
    adminToken = generateAuthToken(admin._id);
    regularUser = await createTestUser({ email: 'regularuser@example.com' });
    userToken = generateAuthToken(regularUser._id);
  });

  describe('GET /api/users', () => {
    beforeEach(async () => {
      // Create additional test users
      await createTestUser({ email: 'user1@example.com', name: 'User One' });
      await createTestUser({ email: 'user2@example.com', name: 'User Two' });
    });

    it('should get all users as admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3); // admin + regularUser + 2 created
      expect(res.body.count).toBeDefined();
      expect(res.body.total).toBeDefined();
    });

    it('should filter users by role', async () => {
      const res = await request(app)
        .get('/api/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(user => user.role === 'admin')).toBe(true);
    });

    it('should filter users by active status', async () => {
      // Create inactive user
      await createTestUser({ email: 'inactive@example.com', isActive: false });

      const res = await request(app)
        .get('/api/users?active=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(user => user.isActive === true)).toBe(true);
    });

    it('should search users by name', async () => {
      const res = await request(app)
        .get('/api/users?search=User One')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.some(user => user.name === 'User One')).toBe(true);
    });

    it('should paginate users', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/users')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get single user by ID', async () => {
      const res = await request(app)
        .get(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('regularuser@example.com');
      // Password should not be returned
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user role as admin', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('admin');
    });

    it('should update user active status', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should fail to update own role', async () => {
      const res = await request(app)
        .put(`/api/users/${admin._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CANNOT_MODIFY_OWN_ROLE');
    });

    it('should fail to deactivate own account', async () => {
      const res = await request(app)
        .put(`/api/users/${admin._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CANNOT_DEACTIVATE_OWN_ACCOUNT');
    });

    it('should fail to update deleted account', async () => {
      const deletedUser = await createTestUser({
        email: 'deleted-123@account.com',
        name: 'Deleted User',
        password: null,
        isActive: false,
      });

      const res = await request(app)
        .put(`/api/users/${deletedUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CANNOT_MODIFY_DELETED_ACCOUNT');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user as admin', async () => {
      const userToDelete = await createTestUser({ email: 'todelete@example.com' });

      const res = await request(app)
        .delete(`/api/users/${userToDelete._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User deleted successfully');

      // Verify user is deleted
      const deletedUser = await User.findById(userToDelete._id);
      expect(deletedUser).toBeNull();
    });

    it('should fail to delete own account', async () => {
      const res = await request(app)
        .delete(`/api/users/${admin._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CANNOT_DELETE_OWN_ACCOUNT');
    });

    it('should fail to delete already deleted account', async () => {
      const deletedUser = await createTestUser({
        email: 'deleted-456@account.com',
        name: 'Already Deleted',
        password: null,
        isActive: false,
      });

      const res = await request(app)
        .delete(`/api/users/${deletedUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('USER_ALREADY_DELETED');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .delete(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/users/stats', () => {
    it('should get user statistics as admin', async () => {
      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(2);
      expect(res.body.data.activeUsers).toBeDefined();
      expect(res.body.data.inactiveUsers).toBeDefined();
      expect(res.body.data.regularUsers).toBeDefined();
      expect(res.body.data.newUsers).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/users/admin', () => {
    beforeEach(async () => {
      await createTestUser({ email: 'adminlist1@example.com', name: 'Admin List User' });
      await createTestUser({ email: 'adminlist2@example.com', isActive: false });
    });

    it('should get users with advanced filtering', async () => {
      const res = await request(app)
        .get('/api/users/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeDefined();
      expect(res.body.pagination.hasMore).toBeDefined();
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/users/admin?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(user => user.isActive === false)).toBe(true);
    });

    it('should search by name or email', async () => {
      const res = await request(app)
        .get('/api/users/admin?search=Admin List')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.some(user => user.name === 'Admin List User')).toBe(true);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/users/admin')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
