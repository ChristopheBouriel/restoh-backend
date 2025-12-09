const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const restaurantRoutes = require('../../routes/restaurant');
const errorHandler = require('../../middleware/errorHandler');
const RestaurantReview = require('../../models/RestaurantReview');
const {
  createTestUser,
  createTestAdmin,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/restaurant', restaurantRoutes);
app.use(errorHandler);

// Helper to create test restaurant review
const createTestRestaurantReview = async (reviewData = {}) => {
  const defaultReview = {
    user: {
      id: reviewData.userId || new mongoose.Types.ObjectId(),
      name: reviewData.userName || 'Test User',
    },
    ratings: {
      overall: reviewData.overall || 4,
      service: reviewData.service || null,
      ambiance: reviewData.ambiance || null,
      food: reviewData.food || null,
      value: reviewData.value || null,
    },
    comment: reviewData.comment || 'Great restaurant!',
    visitDate: reviewData.visitDate || null,
  };

  const review = await RestaurantReview.create(defaultReview);
  return review;
};

describe('Restaurant Review Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;

  beforeEach(async () => {
    user = await createTestUser({ email: 'reviewuser@example.com' });
    admin = await createTestAdmin({ email: 'reviewadmin@example.com' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
  });

  describe('POST /api/restaurant/review', () => {
    it('should add restaurant review with valid data', async () => {
      const reviewData = {
        ratings: {
          overall: 5,
        },
        comment: 'Excellent restaurant, highly recommend!',
      };

      const res = await request(app)
        .post('/api/restaurant/review')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reviewData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ratings.overall).toBe(5);
      expect(res.body.data.comment).toBe('Excellent restaurant, highly recommend!');
      expect(res.body.data.user.id).toBe(user._id.toString());
      expect(res.body.data.user.name).toBe(user.name);
    });

    it('should add review with all rating categories', async () => {
      const reviewData = {
        ratings: {
          overall: 4,
          service: 5,
          ambiance: 4,
          food: 5,
          value: 3,
        },
        comment: 'Great food and service!',
        visitDate: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/restaurant/review')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reviewData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ratings.overall).toBe(4);
      expect(res.body.data.ratings.service).toBe(5);
      expect(res.body.data.ratings.ambiance).toBe(4);
      expect(res.body.data.ratings.food).toBe(5);
      expect(res.body.data.ratings.value).toBe(3);
    });

    it('should fail to add duplicate review', async () => {
      // Create first review
      await createTestRestaurantReview({
        userId: user._id,
        userName: user.name,
      });

      const res = await request(app)
        .post('/api/restaurant/review')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 3 },
          comment: 'Second review attempt',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/restaurant/review')
        .send({
          ratings: { overall: 4 },
          comment: 'Test comment',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail without overall rating', async () => {
      const res = await request(app)
        .post('/api/restaurant/review')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: {
            service: 4,
          },
          comment: 'Missing overall rating',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid rating value', async () => {
      const res = await request(app)
        .post('/api/restaurant/review')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 6 }, // Max is 5
          comment: 'Invalid rating',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with rating below minimum', async () => {
      const res = await request(app)
        .post('/api/restaurant/review')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 0 }, // Min is 1
          comment: 'Invalid rating',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/restaurant/reviews', () => {
    beforeEach(async () => {
      // Create multiple reviews
      await createTestRestaurantReview({
        userId: user._id,
        userName: user.name,
        overall: 5,
        comment: 'First review',
      });
      await createTestRestaurantReview({
        userId: admin._id,
        userName: admin.name,
        overall: 4,
        comment: 'Second review',
      });
    });

    it('should get all reviews (public access)', async () => {
      const res = await request(app)
        .get('/api/restaurant/reviews')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.count).toBeDefined();
    });

    it('should paginate reviews', async () => {
      const res = await request(app)
        .get('/api/restaurant/reviews?page=1&limit=1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
    });

    it('should sort reviews by date (newest first)', async () => {
      const res = await request(app)
        .get('/api/restaurant/reviews')
        .expect(200);

      expect(res.body.success).toBe(true);
      if (res.body.data.length >= 2) {
        const dates = res.body.data.map(r => new Date(r.createdAt).getTime());
        expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
      }
    });
  });

  describe('GET /api/restaurant/rating', () => {
    beforeEach(async () => {
      // Create reviews with various ratings
      await createTestRestaurantReview({
        userId: user._id,
        userName: user.name,
        overall: 5,
        service: 5,
        food: 4,
      });
      await createTestRestaurantReview({
        userId: admin._id,
        userName: admin.name,
        overall: 3,
        service: 4,
        ambiance: 5,
      });
    });

    it('should get rating statistics (public access)', async () => {
      const res = await request(app)
        .get('/api/restaurant/rating')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalReviews).toBeGreaterThanOrEqual(2);
      expect(res.body.data.ratings).toBeDefined();
      expect(res.body.data.ratings.overall).toBeDefined();
      expect(res.body.data.ratings.overall.average).toBeDefined();
      expect(res.body.data.ratings.overall.count).toBeDefined();
    });

    it('should calculate correct average for overall rating', async () => {
      const res = await request(app)
        .get('/api/restaurant/rating')
        .expect(200);

      // (5 + 3) / 2 = 4
      expect(res.body.data.ratings.overall.average).toBe(4);
      expect(res.body.data.ratings.overall.count).toBe(2);
    });

    it('should return zero for categories with no data', async () => {
      // Clear all reviews and add one with only overall rating
      await RestaurantReview.deleteMany({});
      await createTestRestaurantReview({
        userId: user._id,
        userName: user.name,
        overall: 4,
        // No service, ambiance, food, value
      });

      const res = await request(app)
        .get('/api/restaurant/rating')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ratings.value.count).toBe(0);
      expect(res.body.data.ratings.value.average).toBe(0);
    });
  });

  describe('PUT /api/restaurant/review/:id', () => {
    let userReview;

    beforeEach(async () => {
      userReview = await createTestRestaurantReview({
        userId: user._id,
        userName: user.name,
        overall: 3,
        comment: 'Original comment',
      });
    });

    it('should update own review', async () => {
      const res = await request(app)
        .put(`/api/restaurant/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 5 },
          comment: 'Updated comment',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ratings.overall).toBe(5);
      expect(res.body.data.comment).toBe('Updated comment');
    });

    it('should update partial fields', async () => {
      const res = await request(app)
        .put(`/api/restaurant/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          comment: 'Only updating comment',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.comment).toBe('Only updating comment');
      expect(res.body.data.ratings.overall).toBe(3); // Unchanged
    });

    it('should fail to update other user review', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherReview = await createTestRestaurantReview({
        userId: otherUser._id,
        userName: otherUser.name,
      });

      const res = await request(app)
        .put(`/api/restaurant/review/${otherReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 1 },
          comment: 'Trying to modify',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .put(`/api/restaurant/review/${userReview._id}`)
        .send({
          ratings: { overall: 5 },
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/restaurant/review/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 5 },
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid rating value', async () => {
      const res = await request(app)
        .put(`/api/restaurant/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ratings: { overall: 10 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/restaurant/review/:id', () => {
    let userReview;

    beforeEach(async () => {
      userReview = await createTestRestaurantReview({
        userId: user._id,
        userName: user.name,
      });
    });

    it('should delete own review', async () => {
      const res = await request(app)
        .delete(`/api/restaurant/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Restaurant review deleted successfully');

      // Verify deletion
      const deletedReview = await RestaurantReview.findById(userReview._id);
      expect(deletedReview).toBeNull();
    });

    it('should allow admin to delete any review', async () => {
      const res = await request(app)
        .delete(`/api/restaurant/review/${userReview._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should fail to delete other user review (non-admin)', async () => {
      const otherUser = await createTestUser({ email: 'another@example.com' });
      const otherToken = generateAuthToken(otherUser._id);

      const res = await request(app)
        .delete(`/api/restaurant/review/${userReview._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/restaurant/review/${userReview._id}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/restaurant/review/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });
});
