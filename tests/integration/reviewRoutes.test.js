const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const menuRoutes = require('../../routes/menu');
const reviewRoutes = require('../../routes/review');
const errorHandler = require('../../middleware/errorHandler');
const MenuItem = require('../../models/MenuItem');
const {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app with both menu and review routes
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/menu', menuRoutes);
app.use('/api/review', reviewRoutes);
app.use(errorHandler);

// Helper to add a review to a menu item directly in DB
const addReviewToMenuItem = async (menuItem, userId, userName, rating, comment) => {
  const review = {
    _id: new mongoose.Types.ObjectId(),
    user: {
      id: userId,
      name: userName,
    },
    rating,
    comment,
    createdAt: new Date(),
  };
  menuItem.reviews.push(review);
  await menuItem.save();
  await menuItem.calculateAverageRating();
  return review;
};

describe('Menu Item Review Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
  let menuItem;

  beforeEach(async () => {
    user = await createTestUser({ email: 'reviewuser@example.com' });
    admin = await createTestAdmin({ email: 'reviewadmin@example.com' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
    menuItem = await createTestMenuItem({ name: 'Test Dish for Reviews', price: 15.99 });
  });

  describe('POST /api/menu/:id/review (Nested route)', () => {
    it('should add a review to menu item', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          comment: 'Excellent dish!',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Review added successfully');
      expect(res.body.data.rating.average).toBe(5);
      expect(res.body.data.rating.count).toBe(1);
    });

    it('should fail to add duplicate review from same user', async () => {
      // Add first review
      await addReviewToMenuItem(menuItem, user._id, user.name, 4, 'First review');

      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          comment: 'Second review attempt',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .send({
          rating: 5,
          comment: 'Test',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid rating', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 6,
          comment: 'Invalid rating',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with rating below minimum', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 0,
          comment: 'Invalid rating',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/menu/${fakeId}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          comment: 'Test',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/menu/:id/review (Nested route)', () => {
    beforeEach(async () => {
      // Add some reviews
      await addReviewToMenuItem(menuItem, user._id, user.name, 5, 'Great food!');
      await addReviewToMenuItem(menuItem, admin._id, admin.name, 4, 'Very good');
    });

    it('should get all reviews for a menu item (public)', async () => {
      const res = await request(app)
        .get(`/api/menu/${menuItem._id}/review`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for item with no reviews', async () => {
      const newItem = await createTestMenuItem({ name: 'No Reviews Item' });

      const res = await request(app)
        .get(`/api/menu/${newItem._id}/review`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/menu/${fakeId}/review`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/menu/:id/rating (Nested route)', () => {
    it('should get rating stats for a menu item (public)', async () => {
      // Add reviews with different ratings
      await addReviewToMenuItem(menuItem, user._id, user.name, 5, 'Excellent');
      await addReviewToMenuItem(menuItem, admin._id, admin.name, 3, 'Average');

      const res = await request(app)
        .get(`/api/menu/${menuItem._id}/rating`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.average).toBe(4); // (5 + 3) / 2
      expect(res.body.data.count).toBe(2);
    });

    it('should return zero for item with no reviews', async () => {
      const res = await request(app)
        .get(`/api/menu/${menuItem._id}/rating`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.average).toBe(0);
      expect(res.body.data.count).toBe(0);
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/menu/${fakeId}/rating`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/review/:reviewId (Flat route)', () => {
    let userReview;

    beforeEach(async () => {
      userReview = await addReviewToMenuItem(menuItem, user._id, user.name, 3, 'Original comment');
    });

    it('should update own review', async () => {
      const res = await request(app)
        .put(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          comment: 'Updated comment',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Review updated successfully');
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('Updated comment');
    });

    it('should update only rating', async () => {
      const res = await request(app)
        .put(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 4,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.comment).toBe('Original comment'); // Unchanged
    });

    it('should update only comment', async () => {
      const res = await request(app)
        .put(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          comment: 'Only updating comment',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(3); // Unchanged
      expect(res.body.data.comment).toBe('Only updating comment');
    });

    it('should fail to update other user review', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherReview = await addReviewToMenuItem(menuItem, otherUser._id, otherUser.name, 4, 'Other review');

      const res = await request(app)
        .put(`/api/review/${otherReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 1,
          comment: 'Trying to modify',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .put(`/api/review/${userReview._id}`)
        .send({
          rating: 5,
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/review/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid rating value', async () => {
      const res = await request(app)
        .put(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 10,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should recalculate menu item average after update', async () => {
      // Add another review
      await addReviewToMenuItem(menuItem, admin._id, admin.name, 5, 'Admin review');

      // Update user review from 3 to 5
      await request(app)
        .put(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5 })
        .expect(200);

      // Check new average
      const updatedItem = await MenuItem.findById(menuItem._id);
      expect(updatedItem.rating.average).toBe(5); // (5 + 5) / 2
    });
  });

  describe('DELETE /api/review/:reviewId (Flat route)', () => {
    let userReview;

    beforeEach(async () => {
      userReview = await addReviewToMenuItem(menuItem, user._id, user.name, 4, 'Review to delete');
    });

    it('should delete own review', async () => {
      const res = await request(app)
        .delete(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Review deleted successfully');

      // Verify deletion
      const updatedItem = await MenuItem.findById(menuItem._id);
      expect(updatedItem.reviews).toHaveLength(0);
    });

    it('should allow admin to delete any review', async () => {
      const res = await request(app)
        .delete(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should fail to delete other user review (non-admin)', async () => {
      const otherUser = await createTestUser({ email: 'another@example.com' });
      const otherToken = generateAuthToken(otherUser._id);

      const res = await request(app)
        .delete(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/review/${userReview._id}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/review/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should recalculate menu item average after deletion', async () => {
      // Add another review with rating 2
      await addReviewToMenuItem(menuItem, admin._id, admin.name, 2, 'Admin review');

      // Current average should be (4 + 2) / 2 = 3
      let item = await MenuItem.findById(menuItem._id);
      expect(item.rating.average).toBe(3);

      // Delete user review (rating 4)
      await request(app)
        .delete(`/api/review/${userReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // New average should be 2 (only admin review left)
      item = await MenuItem.findById(menuItem._id);
      expect(item.rating.average).toBe(2);
      expect(item.rating.count).toBe(1);
    });
  });
});
