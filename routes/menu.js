const express = require('express');
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  addReview,
  getReviews,
  getRating,
  getPopularItems,
} = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/auth');
const { uploadMenuImage } = require('../middleware/cloudinaryUpload');

const router = express.Router();

// Public routes
router.get('/', getMenuItems);
router.get('/popular', getPopularItems);
router.get('/:id', getMenuItem);

// Review routes (nested)
router.post('/:id/review', protect, addReview);
router.get('/:id/review', getReviews);
router.get('/:id/rating', getRating);

// Admin only routes
router.post('/', protect, authorize('admin'), uploadMenuImage, createMenuItem);
router.put('/:id', protect, authorize('admin'), uploadMenuImage, updateMenuItem);
router.delete('/:id', protect, authorize('admin'), deleteMenuItem);

module.exports = router;