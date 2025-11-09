const User = require('../models/User');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const asyncHandler = require('../utils/asyncHandler');
const {
  createUserNotFoundError,
  createUserAlreadyDeletedError,
  createCannotModifyDeletedAccountError,
  createCannotDeleteOwnAccountError
} = require('../utils/errorHelpers');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;

  let query = {};

  // Filter by role
  if (req.query.role) {
    query.role = req.query.role;
  }

  // Filter by active status
  if (req.query.active !== undefined) {
    query.isActive = req.query.active === 'true';
  }

  // Search by name or email
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  // Pagination result
  const pagination = {};
  if (startIndex + limit < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pagination,
    data: users,
  });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    const errorResponse = createUserNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  console.log(req.body)

  // Check if user exists first
  const existingUser = await User.findById(req.params.id);

  if (!existingUser) {
    const errorResponse = createUserNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Prevent modification of deleted accounts
  if (existingUser.email && existingUser.email.startsWith('deleted-')) {
    const errorResponse = createCannotModifyDeletedAccountError(req.params.id);
    return res.status(400).json(errorResponse);
  }

  // Prevent admin from deactivating their own account
  if (req.user.id === req.params.id && req.body.isActive === false) {
    return res.status(400).json({
      success: false,
      error: 'You cannot deactivate your own account',
      code: 'CANNOT_DEACTIVATE_OWN_ACCOUNT',
      details: {
        userId: req.params.id,
        message: 'Admins cannot deactivate their own account for security reasons.',
        suggestion: 'Ask another administrator to deactivate your account if needed.'
      }
    });
  }

  // Prevent admin from changing their own role
  if (req.user.id === req.params.id && req.body.role && req.body.role !== existingUser.role) {
    return res.status(400).json({
      success: false,
      error: 'You cannot modify your own role',
      code: 'CANNOT_MODIFY_OWN_ROLE',
      details: {
        userId: req.params.id,
        currentRole: existingUser.role,
        attemptedRole: req.body.role,
        message: 'Admins cannot modify their own role for security reasons.',
        suggestion: 'Ask another administrator to change your role if needed.'
      }
    });
  }

  const fieldsToUpdate = {
    role: req.body.role,
    isActive: req.body.isActive,
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(key => {
    if (fieldsToUpdate[key] === undefined) {
      delete fieldsToUpdate[key];
    }
  });

  const user = await User.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  }).select('-password');

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: user,
  });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    const errorResponse = createUserNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Don't allow admin to delete themselves
  if (user._id.toString() === req.user.id) {
    const errorResponse = createCannotDeleteOwnAccountError();
    return res.status(400).json(errorResponse);
  }

  // Prevent deletion of already deleted accounts
  if (user.email && user.email.startsWith('deleted-')) {
    const errorResponse = createUserAlreadyDeletedError(req.params.id);
    return res.status(400).json(errorResponse);
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private/Admin
const getUsersStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const regularUsers = await User.countDocuments({ role: 'user' });

  // Users registered in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newUsers = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Users who logged in in the last 30 days
  const sevenDaysAgo = new Date();
  thirtyDaysAgo.setDate(sevenDaysAgo.getDate() - 30);
  const recentlyLoggedUsers = await User.countDocuments({
    lastLogin: { $gte: thirtyDaysAgo },
  });

  // Users who ordered or reserved in the last 30 days
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  // Get unique user IDs who placed orders in the last month
  const usersWithOrders = await Order.distinct('userId', {
    createdAt: { $gte: oneMonthAgo },
  });

  // Get unique user IDs who made reservations in the last month
  const usersWithReservations = await Reservation.distinct('userId', {
    createdAt: { $gte: oneMonthAgo },
  });

  // Combine both arrays and get unique users (Set prevents counting users twice)
  const activeCustomers = new Set([
    ...usersWithOrders.map(id => id.toString()),
    ...usersWithReservations.map(id => id.toString()),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      regularUsers,
      newUsers,
      recentlyLoggedUsers,
      activeCustomersLastMonth: activeCustomers.size,
    },
  });
});

// @desc    Get all users for admin with advanced filtering
// @route   GET /api/users/admin
// @access  Private/Admin
const getAdminUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200); // Max 200
  const role = req.query.role;
  const status = req.query.status; // 'active' or 'inactive'
  const search = req.query.search;

  let query = {};

  if (role) query.role = role;

  // Handle status filter
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const startIndex = (page - 1) * limit;
  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 }) // Newest first by default
    .limit(limit)
    .skip(startIndex);

  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore
    }
  });
});

module.exports = {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUsersStats,
  getAdminUsers,
};