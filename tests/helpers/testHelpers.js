const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const MenuItem = require('../../models/MenuItem');
const Order = require('../../models/Order');

const createTestUser = async (userData = {}) => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'user',
  };

  // For deleted users, bypass validation
  const mergedData = { ...defaultUser, ...userData };
  const isDeleted = mergedData.email && mergedData.email.startsWith('deleted-');

  if (isDeleted) {
    // Use insertOne to bypass Mongoose validation completely
    const result = await User.collection.insertOne(mergedData);
    const user = await User.findById(result.insertedId);
    return user;
  }

  const user = await User.create(mergedData);
  return user;
};

const createTestAdmin = async (userData = {}) => {
  const defaultAdmin = {
    name: 'Test Admin',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
  };

  const admin = await User.create({ ...defaultAdmin, ...userData });
  return admin;
};

const createTestMenuItem = async (itemData = {}) => {
  const defaultItem = {
    name: 'Test Item',
    description: 'Test description',
    price: 10.99,
    category: 'main',
    cuisine: 'asian',
    image: 'test-image.jpg',
    isAvailable: true,
  };

  const menuItem = await MenuItem.create({ ...defaultItem, ...itemData });
  return menuItem;
};

const createTestOrder = async (orderData = {}) => {
  const defaultOrder = {
    userId: orderData.userId,
    userEmail: 'test@example.com',
    userName: 'Test User',
    items: [{
      menuItem: orderData.menuItemId || null,
      name: 'Test Item',
      quantity: 1,
      price: 10.99,
      image: 'test-image.jpg',
    }],
    totalPrice: 10.99,
    orderType: 'delivery',
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    deliveryAddress: '123 Test St',
  };

  const order = await Order.create({ ...defaultOrder, ...orderData });
  return order;
};

const generateAuthToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const mockRequest = (overrides = {}) => {
  const req = {
    body: {},
    params: {},
    query: {},
    user: null,
    headers: {},
    ...overrides,
  };

  return req;
};

const mockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res; // Critical: must return res for chaining
  });

  res.json = jest.fn((data) => {
    res.data = data;
    return res;
  });

  res.send = jest.fn((data) => {
    res.data = data;
    return res;
  });

  res.set = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);

  return res;
};

const mockNext = () => jest.fn();

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  createTestOrder,
  generateAuthToken,
  mockRequest,
  mockResponse,
  mockNext,
};