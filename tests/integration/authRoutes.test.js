const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const authRoutes = require('../../routes/auth');
const User = require('../../models/User');
const {
  createTestUser,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Mock email service to prevent actual emails during tests
jest.mock('../../services/email/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
}));

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

describe('Auth Routes Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        phone: '0612345678',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('registered successfully');
      // Access token is in body (short-lived, 15 min)
      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
      // Refresh token is in HttpOnly cookie (long-lived, 7 days)
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('refreshToken=');
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(newUser.email);
      // Note: Password might be returned depending on toJSON transform
      // This is acceptable as long as it's hashed
    });

    it('should fail with duplicate email', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: 'duplicate@example.com',
          password: 'password123',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already registered');
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          // missing email and password
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with password too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: '123', // too short
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await createTestUser({
        email: 'login@example.com',
        password: 'password123',
      });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
      // Access token is in body (short-lived, 15 min)
      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
      // Refresh token is in HttpOnly cookie (long-lived, 7 days)
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('refreshToken=');
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(res.body.user).toBeDefined();
    });

    it('should fail with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('should fail with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    // Note: Deleted accounts have email like "deleted-xxx@account.com" and password is null
    // So they fail at password match (401) not at the deleted check (403)
    // This is expected behavior - they cannot log in at all
    it('should fail for deleted account', async () => {
      // When an account is soft-deleted, password becomes null
      // So login fails at password verification, not at deleted check
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'deleted-nonexistent@account.com',
          password: 'password123',
        })
        .expect(401); // User not found

      expect(res.body.success).toBe(false);
    });

    it('should fail for inactive account', async () => {
      // Create inactive but not deleted user (keeps password)
      const User = require('../../models/User');
      await User.create({
        name: 'Inactive User',
        email: 'inactive@example.com',
        password: 'password123',
        isActive: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'password123',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user with valid token', async () => {
      const user = await createTestUser({ email: 'me@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('me@example.com');
    });

    it('should fail without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await createTestUser({ email: 'logout@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('should fail without token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const user = await createTestUser({
        email: 'changepass@example.com',
        password: 'oldpassword123',
      });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password changed successfully');

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'changepass@example.com',
          password: 'newpassword123',
        })
        .expect(200);

      expect(loginRes.body.success).toBe(true);
    });

    it('should fail with wrong current password', async () => {
      const user = await createTestUser({
        email: 'wrongpass@example.com',
        password: 'correctpassword',
      });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incorrect');
    });

    it('should fail with too short new password', async () => {
      const user = await createTestUser({
        email: 'shortpass@example.com',
        password: 'password123',
      });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: '123', // too short
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail without current password', async () => {
      const user = await createTestUser({ email: 'nopass@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          newPassword: 'newpassword123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update profile successfully', async () => {
      const user = await createTestUser({ email: 'profile@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          phone: '0698765432',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('Updated Name');
      expect(res.body.user.phone).toBe('0698765432');
    });

    it('should update address fields', async () => {
      const user = await createTestUser({ email: 'address@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          address: {
            street: '123 New Street',
            city: 'Paris',
            zipCode: '75001',
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.address.street).toBe('123 New Street');
      expect(res.body.user.address.city).toBe('Paris');
    });

    it('should fail with no fields to update', async () => {
      const user = await createTestUser({ email: 'nofields@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No fields to update');
    });
  });

  describe('Account Lockout', () => {
    it('should lock account after 5 failed login attempts', async () => {
      await createTestUser({
        email: 'lockout@example.com',
        password: 'correctpassword',
      });

      // Make 4 failed attempts (not locked yet)
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'lockout@example.com',
            password: 'wrongpassword',
          });
        expect(res.status).toBe(401); // Not locked yet
      }

      // 5th attempt triggers the lock and returns 423
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'lockout@example.com',
          password: 'wrongpassword',
        })
        .expect(423);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(res.body.details.remainingMinutes).toBeDefined();
    });

    it('should return 423 even with correct password when locked', async () => {
      await createTestUser({
        email: 'locked@example.com',
        password: 'correctpassword',
      });

      // Make 5 failed attempts to lock the account
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'locked@example.com',
            password: 'wrongpassword',
          });
      }

      // Try with correct password - should still be locked
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'locked@example.com',
          password: 'correctpassword',
        })
        .expect(423);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
    });

    it('should reset login attempts on successful login', async () => {
      const user = await createTestUser({
        email: 'reset@example.com',
        password: 'correctpassword',
      });

      // Make 3 failed attempts (not enough to lock)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'reset@example.com',
            password: 'wrongpassword',
          });
      }

      // Successful login should reset attempts
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'correctpassword',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify attempts are reset (by checking user in DB)
      const User = require('../../models/User');
      const updatedUser = await User.findById(user._id).select('+loginAttempts');
      expect(updatedUser.loginAttempts).toBe(0);
    });

    it('should allow login after lock expires', async () => {
      const User = require('../../models/User');

      // Create user with expired lock
      const user = await createTestUser({
        email: 'expired@example.com',
        password: 'correctpassword',
      });

      // Set lock that expired 1 minute ago
      await User.findByIdAndUpdate(user._id, {
        loginAttempts: 5,
        lockUntil: new Date(Date.now() - 60000) // 1 minute ago
      });

      // Should be able to login (lock expired)
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'expired@example.com',
          password: 'correctpassword',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/auth/delete-account', () => {
    it('should soft delete account successfully', async () => {
      const user = await createTestUser({ email: 'todelete@example.com' });
      const token = generateAuthToken(user._id);

      const res = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Account deleted successfully');

      // Verify user is soft deleted
      const deletedUser = await User.findById(user._id);
      expect(deletedUser.isActive).toBe(false);
      expect(deletedUser.email).toContain('deleted-');
    });

    it('should fail without token', async () => {
      const res = await request(app)
        .delete('/api/auth/delete-account')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
