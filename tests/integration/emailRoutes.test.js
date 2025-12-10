const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const emailRoutes = require('../../routes/emailRoutes');
const errorHandler = require('../../middleware/errorHandler');
const User = require('../../models/User');
const EmailVerification = require('../../models/EmailVerification');
const PasswordReset = require('../../models/PasswordReset');
const {
  createTestUser,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/email', emailRoutes);
app.use(errorHandler);

describe('Email Routes Integration Tests', () => {
  describe('GET /api/email/verify/:token', () => {
    it('should verify email with valid token', async () => {
      const user = await createTestUser({
        email: 'verify@example.com',
        isEmailVerified: false,
      });
      const verification = await EmailVerification.createToken(user._id, user.email);

      const res = await request(app)
        .get(`/api/email/verify/${verification.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verified');

      // Verify user is now verified
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isEmailVerified).toBe(true);
    });

    it('should return success for already verified email', async () => {
      const user = await createTestUser({
        email: 'alreadyverified@example.com',
        isEmailVerified: true,
      });
      const verification = await EmailVerification.createToken(user._id, user.email);

      const res = await request(app)
        .get(`/api/email/verify/${verification.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('already verified');
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/email/verify/invalid-token-12345')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });

    it('should fail with expired token', async () => {
      const user = await createTestUser({
        email: 'expired@example.com',
        isEmailVerified: false,
      });
      
      // Create token and manually set it as expired
      const verification = await EmailVerification.create({
        userId: user._id,
        email: user.email,
        token: 'expired-token-abc123',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const res = await request(app)
        .get(`/api/email/verify/${verification.token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('POST /api/email/resend-verification', () => {
    it('should resend verification email', async () => {
      const user = await createTestUser({
        email: 'resend@example.com',
        isEmailVerified: false,
      });

      const res = await request(app)
        .post('/api/email/resend-verification')
        .send({ email: user.email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('sent');
    });

    it('should return success for non-existent email (security)', async () => {
      // For security, we don't reveal if email exists
      const res = await request(app)
        .post('/api/email/resend-verification')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should fail for already verified email', async () => {
      const user = await createTestUser({
        email: 'verified@example.com',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/email/resend-verification')
        .send({ email: user.email })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already verified');
    });

    it('should fail without email', async () => {
      const res = await request(app)
        .post('/api/email/resend-verification')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/email/forgot-password', () => {
    it('should send password reset email', async () => {
      const user = await createTestUser({
        email: 'forgot@example.com',
      });

      const res = await request(app)
        .post('/api/email/forgot-password')
        .send({ email: user.email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('sent');
    });

    it('should return success for non-existent email (security)', async () => {
      // For security, we don't reveal if email exists
      const res = await request(app)
        .post('/api/email/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should fail without email', async () => {
      const res = await request(app)
        .post('/api/email/forgot-password')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/email/reset-password/:token', () => {
    it('should reset password with valid token', async () => {
      const user = await createTestUser({
        email: 'reset@example.com',
        password: 'oldpassword123',
      });
      const resetToken = await PasswordReset.createToken(user._id, user.email);

      const res = await request(app)
        .post(`/api/email/reset-password/${resetToken.token}`)
        .send({ password: 'newpassword123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('reset successfully');
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .post('/api/email/reset-password/invalid-token-xyz')
        .send({ password: 'newpassword123' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });

    it('should fail with expired token', async () => {
      const user = await createTestUser({
        email: 'resetexpired@example.com',
      });
      
      // Create token and manually set it as expired
      const resetToken = await PasswordReset.create({
        userId: user._id,
        email: user.email,
        token: 'expired-reset-token-xyz',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const res = await request(app)
        .post(`/api/email/reset-password/${resetToken.token}`)
        .send({ password: 'newpassword123' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('expired');
    });

    it('should fail without password', async () => {
      const user = await createTestUser({
        email: 'nopass@example.com',
      });
      const resetToken = await PasswordReset.createToken(user._id, user.email);

      const res = await request(app)
        .post(`/api/email/reset-password/${resetToken.token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with short password', async () => {
      const user = await createTestUser({
        email: 'shortpass@example.com',
      });
      const resetToken = await PasswordReset.createToken(user._id, user.email);

      const res = await request(app)
        .post(`/api/email/reset-password/${resetToken.token}`)
        .send({ password: '123' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('6 characters');
    });
  });
});
