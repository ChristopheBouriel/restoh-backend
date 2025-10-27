const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfileUser,
  changePassword,
  logout,
  deleteAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protect); // All routes after this middleware are protected

router.get('/me', getMe);
router.put('/profile', updateProfileUser);
router.put('/change-password', changePassword);
router.post('/logout', logout);
router.delete('/delete-account', deleteAccount);

module.exports = router;