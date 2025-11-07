const express = require('express');
const {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUsersStats,
  getAdminUsers,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

// Admin routes (must come before general routes)
router.get('/admin/all', authorize('admin'), getAdminUsers);

// General routes
router.get('/', getUsers);
router.get('/stats', getUsersStats);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;