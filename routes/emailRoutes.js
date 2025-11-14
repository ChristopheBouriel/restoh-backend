const express = require('express');
const {
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} = require('../controllers/emailController');

const router = express.Router();

// Email verification routes
router.get('/verify/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;
