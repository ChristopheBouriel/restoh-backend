const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfileUser,
  changePassword,
  refreshTokenHandler,
  logout,
  deleteAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { strictLimiter, authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes with strict rate limiting
router.post('/register', strictLimiter, register);
router.post('/login', authLimiter, login);

// Refresh token route (public - uses refresh token cookie, not access token)
router.post('/refresh', authLimiter, refreshTokenHandler);

// Protected routes
router.use(protect); // All routes after this middleware are protected

router.get('/me', getMe);
router.put('/profile', updateProfileUser);
router.put('/change-password', changePassword);
router.post('/logout', logout);
router.delete('/delete-account', deleteAccount);

module.exports = router;