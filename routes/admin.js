const express = require('express');
const {
  getDashboardStats,
  togglePopularOverride,
  resetAllPopularOverrides,
  toggleSuggested,
  getAdminSuggestedItems,
  getAdminPopularStatus,
} = require('../controllers/adminController');
const { getAdminUserOrders } = require('../controllers/orderController');
const { getAdminUserReservations } = require('../controllers/reservationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All admin routes are protected
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);

// Get user-specific data
router.get('/users/:userId/orders', getAdminUserOrders);
router.get('/users/:userId/reservations', getAdminUserReservations);

// Menu popular items management
// IMPORTANT: /popular/reset must be defined BEFORE /:id/popular to avoid route conflicts
router.patch('/menu/popular/reset', resetAllPopularOverrides);
router.patch('/menu/:id/popular', togglePopularOverride);
router.get('/menu/popular', getAdminPopularStatus);

// Menu suggestions management
router.patch('/menu/:id/suggested', toggleSuggested);
router.get('/menu/suggested', getAdminSuggestedItems);

module.exports = router;