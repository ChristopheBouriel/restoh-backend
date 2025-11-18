const express = require('express');
const {
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Flat routes - Individual review operations
// These routes use the review ID directly, without needing the parent menuItem ID
// This follows REST best practices: avoid nesting beyond 2 levels for individual resource operations

router.put('/:reviewId', protect, updateReview);
router.delete('/:reviewId', protect, deleteReview);

module.exports = router;
