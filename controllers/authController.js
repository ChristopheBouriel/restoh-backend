const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { validateRegister, validateLogin } = require('../utils/validation');
const { sendTokenResponse, clearTokenCookie } = require('../utils/authCookies');

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
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email',
    });
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone,
  });

  sendTokenResponse(user, 201, res, 'User registered successfully');
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

  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Update last login
  await user.updateLastLogin();

  sendTokenResponse(user, 200, res, 'Login successful');
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
  console.log('updateProfileUser called with body:', req.body);
  console.log('User ID:', req.user._id);

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

  console.log('Fields to update:', fieldsToUpdate);

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

  console.log('User updated successfully:', user._id);
  console.log('User address after update:', user.address);

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
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Delete user account (soft delete)
// @route   DELETE /api/auth/delete-account
// @access  Private
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

  // Import models for orders and reservations
  const Order = require('../models/Order');
  const Reservation = require('../models/Reservation');

  // Generate unique deleted email using user ID to avoid duplicate key errors
  const deletedEmail = `deleted-${req.user._id}@account.com`;

  // Anonymize user data in all orders
  await Order.updateMany(
    { userId: req.user._id },
    {
      $set: {
        userName: null,
        userEmail: deletedEmail,
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
      }
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
  logout,
  deleteAccount,
};