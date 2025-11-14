const express = require('express');
const {
  sendNewsletter,
  sendPromotion,
  getNewsletterStats,
  unsubscribeNewsletter,
  unsubscribePromotions,
} = require('../controllers/newsletterController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Admin routes - require authentication and admin role
router.post('/send', protect, authorize('admin'), sendNewsletter);
router.post('/promotion', protect, authorize('admin'), sendPromotion);
router.get('/stats', protect, authorize('admin'), getNewsletterStats);

// Public routes - unsubscribe links (no auth required)
router.get('/unsubscribe/newsletter/:userId', unsubscribeNewsletter);
router.get('/unsubscribe/promotions/:userId', unsubscribePromotions);

module.exports = router;
