const express = require('express');
const {
  adminLogin,
  getDashboardStats,
} = require('../controllers/adminController');
const { getAdminUserOrders } = require('../controllers/orderController');
const { getAdminUserReservations } = require('../controllers/reservationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public admin routes
router.post('/login', adminLogin);

// Protected admin routes
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);

// Get user-specific data
router.get('/users/:userId/orders', getAdminUserOrders);
router.get('/users/:userId/reservations', getAdminUserReservations);

module.exports = router;