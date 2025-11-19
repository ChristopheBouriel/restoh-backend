const express = require('express');
const {
  addRestaurantReview,
  getRestaurantReviews,
  getRestaurantRating,
  updateRestaurantReview,
  deleteRestaurantReview
} = require('../controllers/restaurantReviewController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/reviews', getRestaurantReviews);
router.get('/rating', getRestaurantRating);

// Protected routes - nested (creation)
router.post('/review', protect, addRestaurantReview);

// Protected routes - flat (individual operations)
router.put('/review/:id', protect, updateRestaurantReview);
router.delete('/review/:id', protect, deleteRestaurantReview);

module.exports = router;
