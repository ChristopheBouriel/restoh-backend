const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { validateRegister, validateLogin, validateUserUpdate } = require('../utils/validation');
const { sendTokenResponse, clearTokenCookie } = require('../utils/authCookies');
const emailService = require('../services/email/emailService');
const {
  createInvalidCredentialsError,
  createEmailExistsError,
  createAccountDeletedError,
  createAccountInactiveError,
  createAccountLockedError,
  createNoRefreshTokenError,
  createInvalidRefreshTokenError,
} = require('../utils/errorHelpers');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/tokenUtils');
const { buildFrontendUrl } = require('../utils/urlUtils');

/**
 * Send dual token response (Access Token + Refresh Token)
 * - Access Token: Short-lived JWT (15 min) returned in response body
 * - Refresh Token: Duration depends on rememberMe option
 *   - rememberMe: true → 7 days (default)
 *   - rememberMe: false → 24 hours
 *
 * @param {Object} user - User document
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object (for refresh token metadata)
 * @param {string} message - Response message
 * @param {boolean} rememberMe - Whether to use long-lived token (default: true for backward compatibility)
 */
const sendDualTokenResponse = async (user, statusCode, res, req, message = 'Success', rememberMe = true) => {
  try {
    // Generate short-lived access token (15 min)
    const accessToken = generateAccessToken(user._id);

    // Generate refresh token (duration based on rememberMe)
    const refreshToken = await generateRefreshToken(user._id, req, rememberMe);

    // Set refresh token in HttpOnly cookie (duration matches token)
    setRefreshTokenCookie(res, refreshToken, rememberMe);

    // Convert Mongoose document to JSON to apply toJSON transform
    const userJSON = user.toJSON ? user.toJSON() : user;

    res.status(statusCode).json({
      success: true,
      message,
      accessToken, // Frontend stores in memory (NOT localStorage)
      refreshToken, // Also in body for Safari ITP fallback (frontend stores in localStorage if cookies blocked)
      user: userJSON,
    });
  } catch (error) {
    logger.error('Failed to send dual token response', {
      userId: user?._id,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw to be caught by asyncHandler
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = validateRegister(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const { name, email, password, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const errorResponse = createEmailExistsError(email);
    return res.status(409).json(errorResponse);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone,
  });

  // Create email verification token
  const verification = await EmailVerification.createToken(user._id, user.email);

  // Send verification email
  const verificationUrl = buildFrontendUrl(`/verify-email/${verification.token}`);

  try {
    await emailService.sendVerificationEmail(user.email, user.name, verificationUrl);
    logger.success('Verification email sent', { userId: user._id });
  } catch (error) {
    logger.error('Failed to send verification email', error);
    // Don't fail registration if email fails, user can request resend
  }

  await sendDualTokenResponse(user, 201, res, req, 'User registered successfully. Please check your email to verify your account.');
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = validateLogin(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const { email, password, rememberMe = false } = req.body;

  // Find user with password and lockout fields
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

  if (!user) {
    const errorResponse = createInvalidCredentialsError(email);
    return res.status(401).json(errorResponse);
  }

  // Check if account is locked
  if (user.isLocked) {
    const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    const errorResponse = createAccountLockedError(remainingMinutes);
    return res.status(423).json(errorResponse);
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    // Increment failed login attempts
    await user.incLoginAttempts();

    // Re-fetch user to check if now locked
    const updatedUser = await User.findById(user._id).select('+lockUntil');
    if (updatedUser.isLocked) {
      const remainingMinutes = Math.ceil((updatedUser.lockUntil - Date.now()) / 60000);
      const errorResponse = createAccountLockedError(remainingMinutes);
      return res.status(423).json(errorResponse);
    }

    const errorResponse = createInvalidCredentialsError();
    return res.status(401).json(errorResponse);
  }

  // Check if account is deleted
  if (user.email && user.email.startsWith('deleted-')) {
    const errorResponse = createAccountDeletedError();
    return res.status(403).json(errorResponse);
  }

  // Check if account is deactivated by admin
  if (!user.isActive) {
    const errorResponse = createAccountInactiveError();
    return res.status(403).json(errorResponse);
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  await user.updateLastLogin();

  await sendDualTokenResponse(user, 200, res, req, 'Login successful', rememberMe);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfileUser = asyncHandler(async (req, res) => {
  logger.debug('updateProfileUser called', { userId: req.user._id });

  // Validate input
  const { error } = validateUserUpdate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  // Handle password change if provided
  if (req.body.newPassword) {
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = req.body.newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  }

  const fieldsToUpdate = {};

  // Only add fields that are provided and not undefined
  if (req.body.name !== undefined) {
    fieldsToUpdate.name = req.body.name;
  }
  if (req.body.phone !== undefined) {
    fieldsToUpdate.phone = req.body.phone;
  }
  if (req.body.email !== undefined) {
    fieldsToUpdate.email = req.body.email;
  }
  if (req.body.preferences !== undefined) {
    fieldsToUpdate.preferences = req.body.preferences;
  }

  // Handle address object - use dot notation to update individual fields
  if (req.body.address && typeof req.body.address === 'object') {
    const addressFields = ['street', 'city', 'zipCode', 'state'];
    addressFields.forEach(field => {
      if (req.body.address[field] !== undefined) {
        fieldsToUpdate[`address.${field}`] = req.body.address[field];
      }
    });
  }

  // Handle notifications object - use dot notation to update individual fields
  if (req.body.notifications && typeof req.body.notifications === 'object') {
    const notificationFields = ['newsletter', 'promotions'];
    notificationFields.forEach(field => {
      if (req.body.notifications[field] !== undefined) {
        fieldsToUpdate[`notifications.${field}`] = req.body.notifications[field];
      }
    });
  }

  logger.debug('Fields to update', { fieldCount: Object.keys(fieldsToUpdate).length });

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No fields to update',
    });
  }

  const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  logger.success('User profile updated', { userId: user._id });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user,
  });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide current password and new password',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters',
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check current password
  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect',
    });
  }

  // Update password
  user.password = newPassword;

  // OWASP Security: Set passwordChangedAt to invalidate old JWT tokens
  user.passwordChangedAt = new Date();

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

// @desc    Refresh access token using refresh token
// @route   POST /api/auth/refresh
// @access  Public (uses refresh token cookie or body for Safari ITP fallback)
const refreshTokenHandler = asyncHandler(async (req, res) => {
  // 1. Get refresh token from cookie OR body (Safari ITP fallback)
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    const errorResponse = createNoRefreshTokenError();
    return res.status(401).json(errorResponse);
  }

  // 2. Verify refresh token in database
  const storedToken = await verifyRefreshToken(refreshToken);

  if (!storedToken) {
    const errorResponse = createInvalidRefreshTokenError();
    return res.status(401).json(errorResponse);
  }

  // 3. Generate new access token
  const accessToken = generateAccessToken(storedToken.userId);

  // 4. Return new access token
  res.status(200).json({
    success: true,
    accessToken,
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // Revoke refresh token in database (from cookie OR body for Safari ITP fallback)
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  // Clear both cookies (refresh token + legacy token)
  clearRefreshTokenCookie(res);
  clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAll = asyncHandler(async (req, res) => {
  // Revoke ALL refresh tokens for this user
  const revokedCount = await revokeAllUserTokens(req.user._id);

  // Clear cookies on current device
  clearRefreshTokenCookie(res);
  clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out from all devices',
    details: {
      revokedSessions: revokedCount,
    },
  });
});

// @desc    Delete user account (soft delete)
// @route   DELETE /api/auth/delete-account
// @access  Private
// @body    { confirmCancelReservations?: boolean } - Required if user has active reservations
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check if account is already deleted
  if (!user.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Account is already deleted',
    });
  }

  // Import models for orders, reservations and contacts
  const Order = require('../models/Order');
  const Reservation = require('../models/Reservation');
  const Contact = require('../models/Contact');

  // Check for unpaid cash orders in preparation or beyond - BLOCKING
  // Restaurant has committed resources (preparing, ready, out-for-delivery)
  // User cannot delete account until order is delivered (and paid) or cancelled
  const unpaidCashOrders = await Order.find({
    userId: req.user._id,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    status: { $in: ['preparing', 'ready', 'out-for-delivery'] },
  });

  if (unpaidCashOrders.length > 0) {
    return res.status(400).json({
      success: false,
      code: 'UNPAID_CASH_ORDERS',
      message: 'You have cash orders currently being prepared or in delivery. You can delete your account once your order has been delivered and payment collected.',
      data: {
        count: unpaidCashOrders.length,
        orders: unpaidCashOrders.map(o => ({
          id: o._id,
          orderNumber: o.orderNumber,
          totalPrice: o.totalPrice,
          status: o.status,
          orderType: o.orderType,
        })),
      },
    });
  }

  // Check for active reservations (confirmed or seated) - WARNING with confirmation
  const activeReservations = await Reservation.find({
    userId: req.user._id,
    status: { $in: ['confirmed', 'seated'] },
  });

  if (activeReservations.length > 0 && !req.body.confirmCancelReservations) {
    return res.status(400).json({
      success: false,
      code: 'ACTIVE_RESERVATIONS_WARNING',
      message: 'You have active reservations. If you delete your account, they will be cancelled.',
      data: {
        count: activeReservations.length,
        reservations: activeReservations.map(r => ({
          id: r._id,
          reservationNumber: r.reservationNumber,
          date: r.date,
          slot: r.slot,
          guests: r.guests,
          status: r.status,
        })),
      },
    });
  }

  // If user confirmed, cancel active reservations
  if (activeReservations.length > 0 && req.body.confirmCancelReservations) {
    await Reservation.updateMany(
      { userId: req.user._id, status: { $in: ['confirmed', 'seated'] } },
      { $set: { status: 'cancelled' } }
    );
  }

  // Generate unique deleted email using user ID to avoid duplicate key errors
  const deletedEmail = `deleted-${req.user._id}@account.com`;

  // Anonymize user data in all orders
  await Order.updateMany(
    { userId: req.user._id },
    {
      $set: {
        userName: null,
        userEmail: deletedEmail,
        phone: null,
      }
    }
  );

  // Anonymize user data in all reservations
  await Reservation.updateMany(
    { userId: req.user._id },
    {
      $set: {
        userName: null,
        userEmail: deletedEmail,
        contactPhone: null,
      }
    }
  );

  // Anonymize user data in all contacts (main contact info) and close the conversation
  await Contact.updateMany(
    { userId: req.user._id },
    {
      $set: {
        name: null,
        email: deletedEmail,
        phone: null,
        status: 'closed',
      }
    }
  );

  // Anonymize user data in discussion messages (where user is the author)
  await Contact.updateMany(
    { 'discussion.userId': req.user._id },
    {
      $set: {
        'discussion.$[elem].name': null,
      }
    },
    {
      arrayFilters: [{ 'elem.userId': req.user._id }]
    }
  );

  // Soft delete: anonymize user data instead of deleting
  // Using findByIdAndUpdate to avoid triggering password hash pre-save hook
  await User.findByIdAndUpdate(
    req.user._id,
    {
      name: null,
      email: deletedEmail,
      password: null,
      phone: null,
      address: {
        street: null,
        city: null,
        state: null,
        zipCode: null,
      },
      isActive: false,
    },
    { validateBeforeSave: false, runValidators: false }
  );

  // Clear the token cookie
  clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfileUser,
  changePassword,
  refreshTokenHandler,
  logout,
  logoutAll,
  deleteAccount,
};