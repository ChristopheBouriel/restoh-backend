const express = require('express');
const {
  submitContactForm,
  getUserContactMessages,
  getContactMessages,
  updateContactMessageStatus,
  addReplyToDiscussion,
  markDiscussionMessageAsRead,
  deleteContactMessage,
} = require('../controllers/contactController');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public route - anyone can submit contact form with spam protection
router.post('/', contactLimiter, optionalAuth, submitContactForm);

// Protected routes - authenticated users
router.get('/my-messages', protect, getUserContactMessages);
router.patch('/:id/reply', protect, addReplyToDiscussion);
router.patch('/:id/discussion/:discussionId/status', protect, markDiscussionMessageAsRead);

// Admin routes - require authentication and admin role
router.get('/admin/messages', protect, authorize('admin'), getContactMessages);
router.patch('/admin/messages/:id/status', protect, authorize('admin'), updateContactMessageStatus);
router.delete('/admin/messages/:id', protect, authorize('admin'), deleteContactMessage);

module.exports = router;