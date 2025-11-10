const express = require('express');
const {
  submitContactForm,
  getContactMessages,
  updateContactMessageStatus,
  deleteContactMessage,
} = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public route - anyone can submit contact form
router.post('/', submitContactForm);

// Admin routes - require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/admin/messages', getContactMessages);
router.patch('/admin/messages/:id/status', updateContactMessageStatus);
router.delete('/admin/messages/:id', deleteContactMessage);

module.exports = router;