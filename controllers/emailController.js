const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const PasswordReset = require('../models/PasswordReset');
const emailService = require('../services/email/emailService');
const asyncHandler = require('../utils/asyncHandler');
const { buildFrontendUrl } = require('../utils/urlUtils');

// @desc    Verify email with token
// @route   GET /api/email/verify/:token
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Find verification token
  const verification = await EmailVerification.findOne({ token });

  if (!verification) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token',
    });
  }

  // Find user first (needed for all cases)
  const user = await User.findById(verification.userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // If token was already used, check if user is verified (handles Safari double-clicks)
  if (verification.used) {
    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email already verified',
      });
    }
    // Token used but user not verified - shouldn't happen, but handle it
    return res.status(400).json({
      success: false,
      message: 'This verification link has already been used. Please request a new one.',
    });
  }

  // Check if token has expired
  if (verification.expiresAt < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'Verification token has expired. Please request a new one.',
    });
  }

  // User already verified (e.g., via another token)
  if (user.isEmailVerified) {
    await verification.markAsUsed();
    return res.status(200).json({
      success: true,
      message: 'Email already verified',
    });
  }

  // Mark email as verified
  user.isEmailVerified = true;
  await user.save();

  // Mark token as used (not delete - allows graceful handling of Safari double-calls)
  await verification.markAsUsed();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! You can now log in.',
  });
});

// @desc    Resend verification email
// @route   POST /api/email/resend-verification
// @access  Public
const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an email address',
    });
  }

  // Find user
  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not
    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a verification email has been sent.',
    });
  }

  // Check if already verified
  if (user.isEmailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified',
    });
  }

  // Create new verification token
  const verification = await EmailVerification.createToken(user._id, user.email);

  // Send verification email
  const verificationUrl = buildFrontendUrl(`/verify-email/${verification.token}`);

  try {
    await emailService.sendVerificationEmail(user.email, user.name, verificationUrl);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    // Delete token if email fails to send
    await verification.deleteOne();
    throw new Error('Failed to send verification email. Please try again later.');
  }
});

// @desc    Request password reset
// @route   POST /api/email/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an email address',
    });
  }

  // Find user
  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not (security best practice)
    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }

  // Create password reset token
  const resetToken = await PasswordReset.createToken(user._id, user.email);

  // Send password reset email
  const resetUrl = buildFrontendUrl(`/reset-password/${resetToken.token}`);

  try {
    await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    // Delete token if email fails to send
    await resetToken.deleteOne();
    throw new Error('Failed to send password reset email. Please try again later.');
  }
});

// @desc    Reset password with token
// @route   POST /api/email/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a new password',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters',
    });
  }

  // Find reset token
  const resetToken = await PasswordReset.findOne({ token });

  if (!resetToken) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token',
    });
  }

  // Check if token is still valid
  if (!resetToken.isValid()) {
    await resetToken.deleteOne();
    return res.status(400).json({
      success: false,
      message: 'Reset token has expired. Please request a new one.',
    });
  }

  // Find user and update password
  const user = await User.findById(resetToken.userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Update password
  user.password = password;

  // OWASP Security: Set passwordChangedAt to invalidate old JWT tokens
  user.passwordChangedAt = new Date();

  await user.save();

  // Mark token as used
  await resetToken.markAsUsed();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully! You can now log in with your new password.',
  });
});

module.exports = {
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};
