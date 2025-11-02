const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const {
  createOrderEmptyItemsError,
  createOrderInvalidTypeError,
  createOrderMissingDeliveryAddressError,
  createOrderNotFoundError,
  createOrderInvalidStatusError,
  createValidationError
} = require('../utils/errorHelpers');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  console.log('Creating order with data:', req.body);
  console.log('User:', req.user);

  const {
    items,
    orderType,
    deliveryAddress,
    paymentMethod,
    phone,
    specialInstructions,
    totalPrice,
    paymentStatus,
    transactionId
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

  if (orderType === 'delivery' && !deliveryAddress) {
    const errorResponse = createOrderMissingDeliveryAddressError();
    return res.status(400).json(errorResponse);
  }

  // Calculate totals from provided data or items
  let calculatedTotal = totalPrice;
  if (!calculatedTotal) {
    calculatedTotal = items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  // Prepare order items
  const orderItems = items.map(item => ({
    menuItem: item.menuItem || item._id,
    quantity: item.quantity,
    price: item.price,
    name: item.name,
    image: item.image
  }));

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
    specialInstructions: specialInstructions || '',
    phone: phone || req.user.phone,
    transactionId: transactionId || null,
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

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getAdminOrders,
  getOrderStats,
};