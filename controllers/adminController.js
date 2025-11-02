const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { validateLogin } = require('../utils/validation');
const { createAdminInvalidCredentialsError, createValidationError } = require('../utils/errorHelpers');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = validateLogin(req.body);
  if (error) {
    const errorResponse = createValidationError(error.details[0].message, {
      field: error.details[0].path.join('.'),
      message: error.details[0].message
    });
    return res.status(400).json(errorResponse);
  }

  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');

  if (!user || user.role !== 'admin') {
    const errorResponse = createAdminInvalidCredentialsError();
    return res.status(401).json(errorResponse);
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    const errorResponse = createAdminInvalidCredentialsError();
    return res.status(401).json(errorResponse);
  }

  // Update last login
  await user.updateLastLogin();

  // Generate token
  const token = user.getSignedJwtToken();

  res.status(200).json({
    success: true,
    message: 'Admin login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
    },
  });
});

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const totalMenuItems = await MenuItem.countDocuments();
  const activeMenuItems = await MenuItem.countDocuments({ isAvailable: true });
  const categories = await MenuItem.distinct('category');
  const cuisines = await MenuItem.distinct('cuisine');

  res.status(200).json({
    success: true,
    data: {
      totalMenuItems,
      activeMenuItems,
      inactiveMenuItems: totalMenuItems - activeMenuItems,
      totalCategories: categories.length,
      totalCuisines: cuisines.length,
      categories,
      cuisines,
    },
  });
});

module.exports = {
  adminLogin,
  getDashboardStats,
};