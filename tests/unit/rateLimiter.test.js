const request = require('supertest');
const express = require('express');

// Mock NODE_ENV for testing
const originalEnv = process.env.NODE_ENV;

describe('Rate Limiter Middleware', () => {
  let app;

  beforeEach(() => {
    // Clear require cache to get fresh limiter instances
    jest.resetModules();
    // Set to production mode to test stricter limits
    // Note: 'test' and 'development' both use relaxed limits
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('strictLimiter', () => {
    beforeEach(() => {
      const { strictLimiter } = require('../../middleware/rateLimiter');
      app = express();
      app.use('/test', strictLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under the limit', async () => {
      const res = await request(app).get('/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should block requests over the limit', async () => {
      // In production, strictLimiter allows 5 requests
      // Make 6 requests to exceed the limit
      for (let i = 0; i < 5; i++) {
        await request(app).get('/test');
      }

      const res = await request(app).get('/test');

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error).toContain('Too many attempts');
    });

    it('should include rate limit headers', async () => {
      const res = await request(app).get('/test');

      expect(res.headers['ratelimit-limit']).toBe('5');
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('authLimiter', () => {
    beforeEach(() => {
      const { authLimiter } = require('../../middleware/rateLimiter');
      app = express();
      // Simulate failed login attempts (401 status)
      app.use('/login', authLimiter, (req, res) => {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
      });
    });

    it('should have limit of 10 requests', async () => {
      const res = await request(app).get('/login');

      expect(res.status).toBe(401); // Login fails but rate limit allows it
      expect(res.headers['ratelimit-limit']).toBe('10');
    });

    it('should block after 10 failed attempts', async () => {
      // Make 10 failed login attempts to hit the limit
      // authLimiter has skipSuccessfulRequests: true, so only non-2xx responses count
      for (let i = 0; i < 10; i++) {
        await request(app).get('/login');
      }

      const res = await request(app).get('/login');

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error).toContain('login attempts');
    });
  });

  describe('moderateLimiter', () => {
    beforeEach(() => {
      const { moderateLimiter } = require('../../middleware/rateLimiter');
      app = express();
      app.use('/admin', moderateLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow 30 requests in production', async () => {
      const res = await request(app).get('/admin');

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('30');
    });
  });

  describe('standardLimiter', () => {
    beforeEach(() => {
      const { standardLimiter } = require('../../middleware/rateLimiter');
      app = express();
      app.use('/api', standardLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow 100 requests in production', async () => {
      const res = await request(app).get('/api');

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('100');
    });
  });

  describe('contactLimiter', () => {
    beforeEach(() => {
      const { contactLimiter } = require('../../middleware/rateLimiter');
      app = express();
      app.use('/contact', contactLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow 3 requests per hour in production', async () => {
      const res = await request(app).get('/contact');

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('3');
    });

    it('should block after 3 contact submissions', async () => {
      // Make 3 requests to hit the limit
      for (let i = 0; i < 3; i++) {
        await request(app).get('/contact');
      }

      const res = await request(app).get('/contact');

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error).toContain('contact requests');
    });
  });

  describe('Development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
    });

    it('should have relaxed limits in development', () => {
      const { strictLimiter, standardLimiter } = require('../../middleware/rateLimiter');

      // Create app for each limiter
      const strictApp = express();
      strictApp.use('/test', strictLimiter, (req, res) => res.json({ success: true }));

      const standardApp = express();
      standardApp.use('/test', standardLimiter, (req, res) => res.json({ success: true }));

      // Test strictLimiter in dev (should be 50)
      return request(strictApp)
        .get('/test')
        .then((res) => {
          expect(res.headers['ratelimit-limit']).toBe('50');
        })
        .then(() => {
          // Test standardLimiter in dev (should be 1000)
          return request(standardApp).get('/test');
        })
        .then((res) => {
          expect(res.headers['ratelimit-limit']).toBe('1000');
        });
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      const { strictLimiter } = require('../../middleware/rateLimiter');
      app = express();
      app.use('/test', strictLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should return proper error format when rate limited', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await request(app).get('/test');
      }

      const res = await request(app).get('/test');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        error: expect.any(String),
        code: 'RATE_LIMIT_EXCEEDED'
      });
    });
  });

  describe('Production limits verification (smoke test)', () => {
    // This test explicitly verifies that production limits are correctly set
    // It acts as a safety net to ensure limits aren't accidentally changed

    it('should have correct production limits for all limiters', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const {
        strictLimiter,
        authLimiter,
        moderateLimiter,
        standardLimiter,
        contactLimiter
      } = require('../../middleware/rateLimiter');

      // Create separate apps for each limiter
      const createApp = (limiter) => {
        const testApp = express();
        testApp.use('/test', limiter, (req, res) => res.json({ ok: true }));
        return testApp;
      };

      // Verify each limiter has the expected production limit
      const strictRes = await request(createApp(strictLimiter)).get('/test');
      expect(strictRes.headers['ratelimit-limit']).toBe('5');

      const authRes = await request(createApp(authLimiter)).get('/test');
      expect(authRes.headers['ratelimit-limit']).toBe('10');

      const moderateRes = await request(createApp(moderateLimiter)).get('/test');
      expect(moderateRes.headers['ratelimit-limit']).toBe('30');

      const standardRes = await request(createApp(standardLimiter)).get('/test');
      expect(standardRes.headers['ratelimit-limit']).toBe('100');

      const contactRes = await request(createApp(contactLimiter)).get('/test');
      expect(contactRes.headers['ratelimit-limit']).toBe('3');
    });

    it('should actually block at the exact production limit', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { strictLimiter } = require('../../middleware/rateLimiter');

      const testApp = express();
      testApp.use('/test', strictLimiter, (req, res) => res.json({ ok: true }));

      // Request 1-5 should succeed
      for (let i = 1; i <= 5; i++) {
        const res = await request(testApp).get('/test');
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-remaining']).toBe(String(5 - i));
      }

      // Request 6 should be blocked
      const blockedRes = await request(testApp).get('/test');
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
