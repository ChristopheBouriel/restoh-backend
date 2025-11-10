const express = require('express');
const {
  submitContactForm,
  getUserContactMessages,
  getContactMessages,
  updateContactMessageStatus,
  addReplyToDiscussion,
  deleteContactMessage,
} = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public route - anyone can submit contact form
router.post('/', submitContactForm);

// Protected routes - authenticated users
router.get('/my-messages', protect, getUserContactMessages);
router.patch('/:id/reply', protect, addReplyToDiscussion);

// Admin routes - require authentication and admin role
router.get('/admin/messages', protect, authorize('admin'), getContactMessages);
router.patch('/admin/messages/:id/status', protect, authorize('admin'), updateContactMessageStatus);
router.delete('/admin/messages/:id', protect, authorize('admin'), deleteContactMessage);

module.exports = router;