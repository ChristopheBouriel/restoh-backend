const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { validateCreateOrder } = require('../utils/validation');
const {
  createOrderEmptyItemsError,
  createOrderInvalidTypeError,
  createOrderMissingDeliveryAddressError,
  createOrderNotFoundError,
  createOrderInvalidStatusError,
  createValidationError,
  createUserNotFoundError
} = require('../utils/errorHelpers');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  console.log('Creating order with data:', req.body);
  console.log('User:', req.user);

  // Validate input
  const { error } = validateCreateOrder(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const {
    items,
    orderType,
    deliveryAddress,
    paymentMethod,
    phone,
    specialInstructions,
    totalPrice,
    paymentStatus,
  } = req.body;

  // Basic validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    const errorResponse = createOrderEmptyItemsError();
    return res.status(400).json(errorResponse);
  }

  if (!orderType || !['delivery', 'pickup'].includes(orderType)) {
    const errorResponse = createOrderInvalidTypeError(orderType, ['delivery', 'pickup']);
    return res.status(400).json(errorResponse);
  }

  if (orderType === 'delivery') {
    // Validate that deliveryAddress exists and has required fields
    if (!deliveryAddress || !deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.zipCode) {
      const errorResponse = createOrderMissingDeliveryAddressError();
      return res.status(400).json(errorResponse);
    }
  }

  // Fetch menu items from database to get accurate data
  const menuItemIds = items.map(item => item.menuItem || item.id || item._id);
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });

  // Validate that all menu items exist
  if (menuItems.length !== items.length) {
    const errorResponse = createValidationError('One or more menu items not found', {
      provided: items.length,
      found: menuItems.length
    });
    return res.status(400).json(errorResponse);
  }

  // Prepare order items with data from database
  const orderItems = items.map(item => {
    const menuItemId = item.menuItem || item.id || item._id;
    const menuItem = menuItems.find(mi => mi._id.toString() === menuItemId.toString());

    if (!menuItem) {
      throw new Error(`Menu item ${menuItemId} not found`);
    }

    return {
      menuItem: menuItem._id,
      name: menuItem.name,
      image: menuItem.image,
      price: menuItem.price,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions || null
    };
  });

  // Calculate totals from database prices (security: prevent price manipulation)
  const calculatedTotal = orderItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Create order in MongoDB
  const order = await Order.create({
    userId: req.user._id,
    userEmail: req.user.email,
    userName: req.user.name,
    items: orderItems,
    totalPrice: Math.round(calculatedTotal * 100) / 100, // Round to 2 decimal places
    orderType,
    paymentStatus: paymentStatus || 'pending',
    paymentMethod: paymentMethod || 'cash',
    deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
    specialInstructions: specialInstructions || null,
    phone: phone || req.user.phone,
    //transactionId: transactionId || null,
  });

  console.log('Order created in MongoDB:', order._id);

  // Update user statistics if payment is already paid
  if (paymentStatus === 'paid') {
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: {
          totalOrders: 1,
          totalSpent: calculatedTotal,
        },
      });
      console.log('User statistics updated for paid order');
    } catch (error) {
      console.error('Error updating user statistics:', error);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: order,
  });
});

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
const getUserOrders = asyncHandler(async (req, res) => {
  console.log('Getting user orders for user:', req.user.id);

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  let query = { userId: req.user._id };

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('items.menuItem', 'name image category price')
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
    count: orders.length,
    total,
    pagination,
    data: orders,
  });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('items.menuItem', 'name image category price');

  if (!order) {
    const errorResponse = createOrderNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Make sure user owns order or is admin
  if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    const errorResponse = createValidationError('Not authorized to access this order', {
      orderId: req.params.id,
      message: 'You can only view your own orders.'
    });
    return res.status(403).json(errorResponse);
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    const errorResponse = createValidationError('Status is required', {
      field: 'status',
      message: 'You must provide a status to update the order.'
    });
    return res.status(400).json(errorResponse);
  }

  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    const errorResponse = createOrderInvalidStatusError('any', status, validStatuses);
    return res.status(400).json(errorResponse);
  }

  // Get the original order to check previous status
  const originalOrder = await Order.findById(req.params.id);

  if (!originalOrder) {
    const errorResponse = createOrderNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Update the order status
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      status,
      updatedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).populate('items.menuItem', 'name price');

  console.log(`✅ Order status updated successfully in MongoDB: ${order._id}`);

  // Update menu items orderCount if order is delivered for the first time
  if (status === 'delivered' && originalOrder.status !== 'delivered') {
    try {
      for (const item of order.items) {
        if (item.menuItem) {
          await MenuItem.findByIdAndUpdate(
            item.menuItem._id,
            {
              $inc: { orderCount: item.quantity }
            }
          );
        }
      }
      console.log('Menu items orderCount updated for delivered order');
    } catch (error) {
      console.error('Error updating menu items orderCount:', error);
    }
  }

  // Update user statistics if order is delivered and payment wasn't already paid
  if (status === 'delivered' && order.paymentStatus !== 'paid') {
    try {
      await User.findByIdAndUpdate(order.userId, {
        $inc: {
          totalOrders: 1,
          totalSpent: order.totalPrice,
        },
      });
      console.log('User statistics updated for delivered order');
    } catch (error) {
      console.error('Error updating user statistics:', error);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully',
    data: order,
  });
});

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    const errorResponse = createOrderNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  if (order.userId.toString() !== req.user._id.toString()) {
    const errorResponse = createValidationError('Not authorized to cancel this order', {
      orderId: req.params.id,
      message: 'You can only cancel your own orders.'
    });
    return res.status(403).json(errorResponse);
  }

  // Check if order can be cancelled
  if (order.status === 'delivered' || order.status === 'cancelled') {
    const errorResponse = createOrderInvalidStatusError(order.status, 'cancelled', []);
    return res.status(400).json(errorResponse);
  }

  // Only allow cancellation if payment is not 'paid' and status is 'pending' or 'confirmed'
  if (order.paymentStatus === 'paid') {
    const errorResponse = createValidationError('Cannot cancel paid orders', {
      orderId: req.params.id,
      paymentStatus: order.paymentStatus,
      message: 'This order has already been paid and cannot be cancelled online.',
      suggestion: 'Please contact customer service for refund assistance.',
      contactEmail: 'support@restoh.com',
      contactPhone: '+33 1 23 45 67 89'
    });
    return res.status(400).json(errorResponse);
  }

  if (order.status !== 'pending' && order.status !== 'confirmed') {
    const errorResponse = createOrderInvalidStatusError(order.status, 'cancelled', ['pending', 'confirmed']);
    return res.status(400).json(errorResponse);
  }

  order.status = 'cancelled';
  order.updatedAt = new Date();
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: order,
  });
});

// @desc    Delete order (Admin only)
// @route   DELETE /api/orders/:id/delete
// @access  Private/Admin
const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    const errorResponse = createOrderNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Only allow deletion of delivered or cancelled orders
  if (order.status !== 'delivered' && order.status !== 'cancelled') {
    const errorResponse = createValidationError('Only delivered or cancelled orders can be deleted', {
      orderId: req.params.id,
      currentStatus: order.status,
      allowedStatuses: ['delivered', 'cancelled'],
      message: `This order is currently ${order.status}. Orders can only be deleted when they are delivered or cancelled.`,
      suggestion: 'Update the order status first or wait until the order is completed.'
    });
    return res.status(400).json(errorResponse);
  }

  await Order.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Order deleted successfully',
  });
});

// @desc    Get admin orders (with filters and pagination)
// @route   GET /api/orders/admin
// @access  Private/Admin
const getAdminOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const status = req.query.status;
  const orderType = req.query.orderType;
  const paymentMethod = req.query.paymentMethod;
  const search = req.query.search;

  let query = {};

  if (status) query.status = status;
  if (orderType) query.orderType = orderType;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { userName: { $regex: search, $options: 'i' } },
      { userEmail: { $regex: search, $options: 'i' } },
    ];
  }

  const startIndex = (page - 1) * limit;
  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('items.menuItem', 'name price')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  const pagination = {};
  if (startIndex + limit < total) {
    pagination.next = { page: page + 1, limit };
  }
  if (startIndex > 0) {
    pagination.prev = { page: page - 1, limit };
  }

  console.log(`✅ Found ${orders.length} orders in MongoDB for admin`);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    pagination,
    data: orders,
  });
});

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private/Admin
const getOrderStats = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ status: 'pending' });
  const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
  const preparingOrders = await Order.countDocuments({ status: 'preparing' });
  const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
  const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

  // Revenue calculation
  const revenueResult = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
  ]);
  const totalRevenue = revenueResult[0]?.totalRevenue || 0;

  res.status(200).json({
    success: true,
    data: {
      totalOrders,
      totalRevenue,
      ordersByStatus: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        preparing: preparingOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
    },
  });
});

// @desc    Get recent orders (last 15 days) for admin
// @route   GET /api/orders/admin/recent
// @access  Private/Admin
const getRecentAdminOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100); // Max 100
  const status = req.query.status;

  // Calculate date 15 days ago
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  let query = {
    createdAt: { $gte: fifteenDaysAgo }
  };

  if (status) query.status = status;

  const startIndex = (page - 1) * limit;
  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('items.menuItem', 'name price')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore
    }
  });
});

// @desc    Get historical orders (> 15 days) for admin
// @route   GET /api/orders/admin/history
// @access  Private/Admin
const getHistoricalAdminOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50); // Max 50
  const status = req.query.status;
  const search = req.query.search;
  const { startDate, endDate } = req.query;

  // Validate required date range
  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Both startDate and endDate are required',
      code: 'INVALID_DATE_RANGE'
    });
  }

  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include the entire end date

  // Validate date range (max 1 year)
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  if (end - start > oneYearInMs) {
    return res.status(400).json({
      success: false,
      error: 'Date range cannot exceed 1 year',
      code: 'INVALID_DATE_RANGE'
    });
  }

  let query = {
    createdAt: { $gte: start, $lte: end }
  };

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { userName: { $regex: search, $options: 'i' } },
      { userEmail: { $regex: search, $options: 'i' } }
    ];
  }

  const startIndex = (page - 1) * limit;
  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('items.menuItem', 'name price')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore
    }
  });
});

// @desc    Get orders for a specific user (Admin)
// @route   GET /api/admin/users/:userId/orders
// @access  Private/Admin
const getAdminUserOrders = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    const errorResponse = createUserNotFoundError(userId);
    return res.status(404).json(errorResponse);
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;

  let query = { userId };

  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate('items.menuItem', 'name image category price')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  // Pagination info
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
    count: orders.length,
    total,
    pagination,
    data: orders,
  });
});

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getAdminOrders,
  getOrderStats,
  getRecentAdminOrders,
  getHistoricalAdminOrders,
  getAdminUserOrders,
};