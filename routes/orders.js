const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getAdminOrders,
  getOrderStats,
  getRecentAdminOrders,
  getHistoricalAdminOrders,
} = require('../controllers/orderController');
const { protect, authorize, requireEmailVerified } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Admin routes - MUST be before /:id routes to avoid conflicts
router.get('/admin/recent', authorize('admin'), getRecentAdminOrders);
router.get('/admin/history', authorize('admin'), getHistoricalAdminOrders);
router.get('/admin', authorize('admin'), getAdminOrders);
router.get('/stats', authorize('admin'), getOrderStats);

// User routes - createOrder requires verified email
router.post('/', requireEmailVerified, createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrder);
router.patch('/:id/status', authorize('admin'), updateOrderStatus);
router.delete('/:id', cancelOrder);
router.delete('/:id/delete', authorize('admin'), deleteOrder);

module.exports = router;