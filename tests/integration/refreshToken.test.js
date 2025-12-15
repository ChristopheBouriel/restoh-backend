const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const authRoutes = require('../../routes/auth');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
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

describe('Refresh Token System Integration Tests', () => {
  describe('POST /api/auth/login - Dual Token Response', () => {
    beforeEach(async () => {
      await createTestUser({
        email: 'refresh-test@example.com',
        password: 'password123',
      });
    });

    it('should return accessToken in body and refreshToken in cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh-test@example.com',
          password: 'password123',
        })
        .expect(200);

      // Access token in body
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');

      // Verify it's a valid JWT
      const decoded = jwt.decode(res.body.accessToken);
      expect(decoded).toBeDefined();
      expect(decoded.id).toBeDefined();
      expect(decoded.type).toBe('access');

      // Refresh token in HttpOnly cookie
      expect(res.headers['set-cookie']).toBeDefined();
      const refreshCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/auth');
    });

    it('should store refresh token in database', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh-test@example.com',
          password: 'password123',
        })
        .expect(200);

      // Extract refresh token from cookie
      const refreshCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
      const refreshToken = refreshCookie.split('=')[1].split(';')[0];

      // Verify it exists in database
      const storedToken = await RefreshToken.findOne({ token: refreshToken });
      expect(storedToken).toBeDefined();
      expect(storedToken.userId.toString()).toBe(res.body.user.id);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let user;
    let refreshToken;

    beforeEach(async () => {
      user = await createTestUser({
        email: 'refresh-endpoint@example.com',
        password: 'password123',
      });

      // Login to get refresh token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh-endpoint@example.com',
          password: 'password123',
        });

      // Extract refresh token from cookie
      const refreshCookie = loginRes.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
      refreshToken = refreshCookie.split('=')[1].split(';')[0];
    });

    it('should return new access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();

      // Verify the new access token is valid
      const decoded = jwt.decode(res.body.accessToken);
      expect(decoded.id).toBe(user._id.toString());
    });

    it('should reject without refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_NO_REFRESH_TOKEN');
    });

    it('should reject with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token-12345')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('should reject with revoked refresh token', async () => {
      // Revoke the token
      await RefreshToken.deleteOne({ token: refreshToken });

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/logout - Token Revocation', () => {
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      await createTestUser({
        email: 'logout-test@example.com',
        password: 'password123',
      });

      // Login to get tokens
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logout-test@example.com',
          password: 'password123',
        });

      accessToken = loginRes.body.accessToken;
      const refreshCookie = loginRes.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
      refreshToken = refreshCookie.split('=')[1].split(';')[0];
    });

    it('should revoke refresh token in database on logout', async () => {
      // Verify token exists before logout
      const beforeLogout = await RefreshToken.findOne({ token: refreshToken });
      expect(beforeLogout).toBeDefined();

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      // Verify token is deleted
      const afterLogout = await RefreshToken.findOne({ token: refreshToken });
      expect(afterLogout).toBeNull();
    });

    it('should reject refresh after logout', async () => {
      // Logout first
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      // Try to refresh
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401);

      expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/logout-all - Revoke All Sessions', () => {
    let user;
    let accessToken;
    let refreshTokens = [];

    beforeEach(async () => {
      user = await createTestUser({
        email: 'logout-all@example.com',
        password: 'password123',
      });

      // Simulate multiple logins (multiple devices)
      for (let i = 0; i < 3; i++) {
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'logout-all@example.com',
            password: 'password123',
          });

        if (i === 0) {
          accessToken = loginRes.body.accessToken;
        }

        const refreshCookie = loginRes.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
        refreshTokens.push(refreshCookie.split('=')[1].split(';')[0]);
      }
    });

    it('should revoke all refresh tokens for user', async () => {
      // Verify multiple tokens exist
      const tokensBefore = await RefreshToken.countDocuments({ userId: user._id });
      expect(tokensBefore).toBe(3);

      // Logout all
      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out from all devices');
      expect(res.body.details.revokedSessions).toBe(3);

      // Verify all tokens are deleted
      const tokensAfter = await RefreshToken.countDocuments({ userId: user._id });
      expect(tokensAfter).toBe(0);
    });

    it('should reject refresh from all devices after logout-all', async () => {
      // Logout all
      await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to refresh with each token
      for (const token of refreshTokens) {
        const res = await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', `refreshToken=${token}`)
          .expect(401);

        expect(res.body.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
      }
    });
  });

  describe('Protected Routes with Access Token', () => {
    let user;
    let accessToken;

    beforeEach(async () => {
      user = await createTestUser({
        email: 'protected-test@example.com',
        password: 'password123',
      });

      // Login to get access token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'protected-test@example.com',
          password: 'password123',
        });

      accessToken = loginRes.body.accessToken;
    });

    it('should accept valid access token in Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('protected-test@example.com');
    });

    it('should return AUTH_TOKEN_EXPIRED for expired access token', async () => {
      // Create an expired token (issued 1 hour ago, expires in 15 min)
      const expiredToken = jwt.sign(
        { id: user._id, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_TOKEN_EXPIRED');
      expect(res.body.details.action).toBe('call-refresh');
    });

    it('should reject invalid access token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register - Dual Token Response', () => {
    it('should return accessToken in body and refreshToken in cookie on register', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New User',
          email: 'newuser-refresh@example.com',
          password: 'password123',
          phone: '0612345678',
        })
        .expect(201);

      // Access token in body
      expect(res.body.accessToken).toBeDefined();

      // Refresh token in cookie
      const refreshCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });
  });
});
