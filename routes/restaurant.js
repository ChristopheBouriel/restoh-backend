const express = require('express');
const {
  addRestaurantReview,
  getRestaurantReviews,
  getRestaurantRating,
  updateRestaurantReview,
  deleteRestaurantReview
} = require('../controllers/restaurantReviewController');
const { protect, requireEmailVerified } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/reviews', getRestaurantReviews);
router.get('/rating', getRestaurantRating);

// Protected routes - nested (creation) - require verified email
router.post('/review', protect, requireEmailVerified, addRestaurantReview);

// Protected routes - flat (individual operations) - require verified email
router.put('/review/:id', protect, requireEmailVerified, updateRestaurantReview);
router.delete('/review/:id', protect, requireEmailVerified, deleteRestaurantReview);

module.exports = router;
