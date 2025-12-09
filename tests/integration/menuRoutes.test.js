const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

// cloudinaryUpload is auto-mocked via moduleNameMapper in jest.config.js

const menuRoutes = require('../../routes/menu');
const errorHandler = require('../../middleware/errorHandler');
const MenuItem = require('../../models/MenuItem');
const {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app with real auth
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/menu', menuRoutes);
app.use(errorHandler);

describe('Menu Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;

  beforeEach(async () => {
    user = await createTestUser({ email: 'menuuser@example.com', name: 'Menu User' });
    admin = await createTestAdmin({ email: 'menuadmin@example.com', name: 'Menu Admin' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
  });

  describe('GET /api/menu', () => {
    it('should get all menu items (public)', async () => {
      await createTestMenuItem({ name: 'Test Item 1', price: 10 });
      await createTestMenuItem({ name: 'Test Item 2', price: 20 });

      const res = await request(app)
        .get('/api/menu')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should filter items by category', async () => {
      await createTestMenuItem({ name: 'Main Dish', category: 'main' });
      await createTestMenuItem({ name: 'Appetizer', category: 'appetizer' });

      const res = await request(app)
        .get('/api/menu?category=main')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].category).toBe('main');
    });

    it('should filter vegetarian items', async () => {
      await createTestMenuItem({ name: 'Meat Dish', isVegetarian: false });
      await createTestMenuItem({ name: 'Veggie Dish', isVegetarian: true });

      const res = await request(app)
        .get('/api/menu?vegetarian=true')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].isVegetarian).toBe(true);
    });

    it('should search items by name', async () => {
      await createTestMenuItem({ name: 'Chicken Curry' });
      await createTestMenuItem({ name: 'Beef Steak' });

      const res = await request(app)
        .get('/api/menu?search=chicken')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toMatch(/chicken/i);
    });

    it('should handle pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestMenuItem({ name: `Item ${i}` });
      }

      const res = await request(app)
        .get('/api/menu?page=2&limit=2')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toHaveProperty('prev');
      expect(res.body.pagination).toHaveProperty('next');
    });

  });

  describe('GET /api/menu/popular', () => {
    it('should get popular menu items (public)', async () => {
      await createTestMenuItem({ name: 'Popular Item', category: 'main', orderCount: 50 });
      await createTestMenuItem({ name: 'Less Popular', category: 'main', orderCount: 10 });

      const res = await request(app)
        .get('/api/menu/popular')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return items distributed by category', async () => {
      await createTestMenuItem({ name: 'Appetizer 1', category: 'appetizer', orderCount: 100 });
      await createTestMenuItem({ name: 'Main 1', category: 'main', orderCount: 100 });
      await createTestMenuItem({ name: 'Dessert 1', category: 'dessert', orderCount: 100 });
      await createTestMenuItem({ name: 'Beverage 1', category: 'beverage', orderCount: 100 });

      const res = await request(app)
        .get('/api/menu/popular')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('should exclude items with isPopularOverride flag', async () => {
      await createTestMenuItem({ name: 'Excluded Popular', category: 'main', orderCount: 1000, isPopularOverride: true });
      await createTestMenuItem({ name: 'Normal Popular', category: 'main', orderCount: 50, isPopularOverride: false });

      const res = await request(app)
        .get('/api/menu/popular')
        .expect(200);

      expect(res.body.success).toBe(true);
      const excludedItem = res.body.data.find(item => item.name === 'Excluded Popular');
      expect(excludedItem).toBeUndefined();
    });
  });

  describe('GET /api/menu/suggestions', () => {
    it('should get suggested menu items (public)', async () => {
      await createTestMenuItem({ name: 'Suggested Item', isSuggested: true });
      await createTestMenuItem({ name: 'Normal Item', isSuggested: false });

      const res = await request(app)
        .get('/api/menu/suggestions')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(item => item.isSuggested === true)).toBe(true);
    });

    it('should return empty array when no suggested items', async () => {
      await createTestMenuItem({ name: 'Normal Item', isSuggested: false });

      const res = await request(app)
        .get('/api/menu/suggestions')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/menu/:id', () => {
    it('should get a single menu item (public)', async () => {
      const menuItem = await createTestMenuItem({ name: 'Test Item' });

      const res = await request(app)
        .get(`/api/menu/${menuItem._id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Item');
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/menu/${fakeId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for invalid ObjectId format', async () => {
      const res = await request(app)
        .get('/api/menu/invalid-id')
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/menu (Admin only)', () => {
    const validMenuItem = {
      name: 'New Dish',
      description: 'A delicious new dish',
      price: 25.99,
      category: 'main',
      isAvailable: true,
    };

    it('should create a menu item as admin', async () => {
      const res = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validMenuItem)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Menu item created successfully');
      expect(res.body.data.name).toBe('New Dish');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/menu')
        .send(validMenuItem)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validMenuItem)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Only Name' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid price', async () => {
      const res = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validMenuItem, price: -10 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid category', async () => {
      const res = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validMenuItem, category: 'invalid-category' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/menu/:id (Admin only)', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Original Name', price: 20 });
    });

    it('should update a menu item as admin', async () => {
      const res = await request(app)
        .put(`/api/menu/${menuItem._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name', price: 30 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Menu item updated successfully');
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.price).toBe(30);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .put(`/api/menu/${menuItem._id}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .put(`/api/menu/${menuItem._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/menu/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid price', async () => {
      const res = await request(app)
        .put(`/api/menu/${menuItem._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: -10 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should update availability status', async () => {
      const res = await request(app)
        .put(`/api/menu/${menuItem._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAvailable: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isAvailable).toBe(false);
    });
  });

  describe('DELETE /api/menu/:id (Admin only)', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Item to Delete' });
    });

    it('should delete a menu item as admin', async () => {
      const res = await request(app)
        .delete(`/api/menu/${menuItem._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Menu item deleted successfully');

      // Verify deletion
      const deleted = await MenuItem.findById(menuItem._id);
      expect(deleted).toBeNull();
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/menu/${menuItem._id}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .delete(`/api/menu/${menuItem._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/menu/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/menu/:id/review (Auth required)', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Item for Review' });
    });

    it('should add a review as authenticated user', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Excellent dish!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Review added successfully');
      expect(res.body.data.rating.average).toBe(5);
      expect(res.body.data.rating.count).toBe(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .send({ rating: 5, comment: 'Great!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid rating (too high)', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 6, comment: 'Invalid rating' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid rating (too low)', async () => {
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 0, comment: 'Invalid rating' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail to add duplicate review', async () => {
      // Add first review
      await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 4, comment: 'First review' })
        .expect(200);

      // Try to add second review
      const res = await request(app)
        .post(`/api/menu/${menuItem._id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Second review' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/menu/${fakeId}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Great!' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/menu/:id/review (Public)', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Item with Reviews' });
      // Add reviews directly
      menuItem.reviews.push({
        _id: new mongoose.Types.ObjectId(),
        user: { id: user._id, name: user.name },
        rating: 5,
        comment: 'Great!',
        createdAt: new Date(),
      });
      menuItem.reviews.push({
        _id: new mongoose.Types.ObjectId(),
        user: { id: admin._id, name: admin.name },
        rating: 4,
        comment: 'Very good',
        createdAt: new Date(),
      });
      await menuItem.save();
      await menuItem.calculateAverageRating();
    });

    it('should get all reviews for a menu item', async () => {
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

  describe('GET /api/menu/:id/rating (Public)', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await createTestMenuItem({ name: 'Item for Rating' });
    });

    it('should get rating stats for a menu item', async () => {
      // Add reviews
      menuItem.reviews.push({
        _id: new mongoose.Types.ObjectId(),
        user: { id: user._id, name: user.name },
        rating: 5,
        comment: 'Excellent',
        createdAt: new Date(),
      });
      menuItem.reviews.push({
        _id: new mongoose.Types.ObjectId(),
        user: { id: admin._id, name: admin.name },
        rating: 3,
        comment: 'Average',
        createdAt: new Date(),
      });
      await menuItem.save();
      await menuItem.calculateAverageRating();

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
});
