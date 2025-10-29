const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

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
    return res.status(400).json({
      success: false,
      message: 'Order must contain at least one item',
    });
  }

  if (!orderType || !['delivery', 'pickup'].includes(orderType)) {
    return res.status(400).json({
      success: false,
      message: 'Order type must be either delivery or pickup',
    });
  }

  if (orderType === 'delivery' && !deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'Delivery address is required for delivery orders',
    });
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
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Make sure user owns order or is admin
  if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this order',
    });
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
    return res.status(400).json({
      success: false,
      message: 'Status is required',
    });
  }

  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  // Get the original order to check previous status
  const originalOrder = await Order.findById(req.params.id);

  if (!originalOrder) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
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
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this order',
    });
  }

  // Check if order can be cancelled
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel order that is already delivered or cancelled',
    });
  }

  // Only allow cancellation if payment is not 'paid' and status is 'pending' or 'confirmed'
  if (order.paymentStatus === 'paid') {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel paid orders. Please contact customer service for refunds.',
    });
  }

  if (order.status !== 'pending' && order.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: 'Order can only be cancelled when status is pending or confirmed',
    });
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
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Only allow deletion of delivered or cancelled orders
  if (order.status !== 'delivered' && order.status !== 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Only delivered or cancelled orders can be deleted',
    });
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