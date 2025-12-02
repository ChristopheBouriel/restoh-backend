const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { createMenuItemNotFoundError } = require('../utils/errorHelpers');

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

// @desc    Toggle popular override for a menu item
// @route   PATCH /api/admin/menu/:id/popular
// @access  Private/Admin
const togglePopularOverride = asyncHandler(async (req, res) => {
  const menuItem = await MenuItem.findById(req.params.id);

  if (!menuItem) {
    const errorResponse = createMenuItemNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Toggle the override value
  menuItem.isPopularOverride = !menuItem.isPopularOverride;
  await menuItem.save();

  res.status(200).json({
    success: true,
    message: menuItem.isPopularOverride
      ? 'Menu item excluded from popular items'
      : 'Menu item included in popular items selection',
    data: {
      id: menuItem._id,
      name: menuItem.name,
      isPopularOverride: menuItem.isPopularOverride,
    },
  });
});

// @desc    Reset all popular overrides to false
// @route   PATCH /api/admin/menu/popular/reset
// @access  Private/Admin
const resetAllPopularOverrides = asyncHandler(async (req, res) => {
  const result = await MenuItem.updateMany(
    { isPopularOverride: true },
    { $set: { isPopularOverride: false } }
  );

  res.status(200).json({
    success: true,
    message: 'All popular overrides have been reset',
    data: {
      modifiedCount: result.modifiedCount,
    },
  });
});

// @desc    Toggle suggested status for a menu item
// @route   PATCH /api/admin/menu/:id/suggested
// @access  Private/Admin
const toggleSuggested = asyncHandler(async (req, res) => {
  const menuItem = await MenuItem.findById(req.params.id);

  if (!menuItem) {
    const errorResponse = createMenuItemNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Toggle the suggested value
  menuItem.isSuggested = !menuItem.isSuggested;
  await menuItem.save();

  res.status(200).json({
    success: true,
    message: menuItem.isSuggested
      ? 'Menu item added to restaurant suggestions'
      : 'Menu item removed from restaurant suggestions',
    data: {
      id: menuItem._id,
      name: menuItem.name,
      isSuggested: menuItem.isSuggested,
    },
  });
});

// @desc    Get all suggested items (admin view with all fields)
// @route   GET /api/admin/menu/suggested
// @access  Private/Admin
const getAdminSuggestedItems = asyncHandler(async (req, res) => {
  const suggestedItems = await MenuItem.find({ isSuggested: true })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: suggestedItems.length,
    data: suggestedItems,
  });
});

// @desc    Get popular items status (admin view showing overrides)
// @route   GET /api/admin/menu/popular
// @access  Private/Admin
const getAdminPopularStatus = asyncHandler(async (req, res) => {
  // Get items with overrides
  const overriddenItems = await MenuItem.find({ isPopularOverride: true })
    .select('name category orderCount isPopularOverride isAvailable')
    .sort({ category: 1, orderCount: -1 });

  // Get count by category
  const overridesByCategory = await MenuItem.aggregate([
    { $match: { isPopularOverride: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overriddenItems,
      overridesByCategory,
      totalOverridden: overriddenItems.length,
    },
  });
});

module.exports = {
  getDashboardStats,
  togglePopularOverride,
  resetAllPopularOverrides,
  toggleSuggested,
  getAdminSuggestedItems,
  getAdminPopularStatus,
};