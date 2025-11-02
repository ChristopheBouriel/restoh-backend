const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { validateLogin, validateMenuItem } = require('../utils/validation');
const { getTempUsers } = require('./authController');
const { getTempMenuItems } = require('./menuController');
const { createAdminInvalidCredentialsError } = require('../utils/errorHelpers');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = validateLogin(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const { email, password } = req.body;

  try {
    // Try to use MongoDB first
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
  } catch (dbError) {
    // Fallback to in-memory storage for testing
    console.log('Using in-memory storage for admin login...');
    
    const tempUsers = getTempUsers();
    const tempUser = tempUsers.find(u => u.email === email && u.role === 'admin');

    if (!tempUser) {
      const errorResponse = createAdminInvalidCredentialsError();
      return res.status(401).json(errorResponse);
    }

    // Check password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, tempUser.password);

    if (!isMatch) {
      const errorResponse = createAdminInvalidCredentialsError();
      return res.status(401).json(errorResponse);
    }

    // Update last login
    tempUser.lastLogin = new Date();

    // Generate token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: tempUser.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(200).json({
      success: true,
      message: 'Admin login successful (temp storage)',
      token,
      user: {
        id: tempUser.id,
        name: tempUser.name,
        email: tempUser.email,
        role: tempUser.role,
        lastLogin: tempUser.lastLogin,
      },
    });
  }
});

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Try MongoDB first
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
  } catch (dbError) {
    // Fallback stats for temp storage
    const tempMenuItems = getTempMenuItems();
    const totalMenuItems = tempMenuItems.length;
    const activeMenuItems = tempMenuItems.filter(item => item.isAvailable).length;
    const categories = [...new Set(tempMenuItems.map(item => item.category))];
    const cuisines = [...new Set(tempMenuItems.map(item => item.cuisine))];

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
  }
});

module.exports = {
  adminLogin,
  getDashboardStats,
};