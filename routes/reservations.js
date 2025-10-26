const express = require('express');
const {
  createReservation,
  getUserReservations,
  getAdminReservations,
  updateAdminReservation,
  updateReservationStatus,
  updateUserReservation,
  cancelUserReservation,
  getReservationStats,
} = require('../controllers/reservationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// User routes
router.post('/', createReservation);
router.get('/', getUserReservations);
router.put('/:id', updateUserReservation);
router.delete('/:id', cancelUserReservation);

// Admin routes
router.get('/admin', authorize('admin'), getAdminReservations);
router.get('/admin/stats', authorize('admin'), getReservationStats);
router.patch('/admin/:id/status', authorize('admin'), updateReservationStatus);
router.put('/admin/:id', authorize('admin'), updateAdminReservation);

module.exports = router;