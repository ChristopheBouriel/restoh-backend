const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');

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
  getDashboardStats,
};