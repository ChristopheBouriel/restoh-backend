const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const MenuItem = require('../../models/MenuItem');
const Order = require('../../models/Order');
const Reservation = require('../../models/Reservation');
const Table = require('../../models/Table');

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
  // Create a default menu item if menuItemId is not provided
  let menuItemId = orderData.menuItemId;
  if (!menuItemId) {
    const defaultMenuItem = await createTestMenuItem({
      name: 'Default Test Item for Order',
      price: 10.99,
    });
    menuItemId = defaultMenuItem._id;
  }

  const defaultOrder = {
    userId: orderData.userId,
    userEmail: 'test@example.com',
    userName: 'Test User',
    phone: '0612345678',
    items: [{
      menuItem: menuItemId,
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
    deliveryAddress: {
      street: '123 Test St',
      city: 'Test City',
      zipCode: '75001',
    },
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

// Helper to get a future date (days from now)
const getFutureDate = (daysFromNow = 3) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
};

const createTestTable = async (tableData = {}) => {
  const defaultTable = {
    tableNumber: tableData.tableNumber || 1,
    capacity: tableData.capacity || 4,
    isActive: true,
    tableBookings: [],
  };

  const table = await Table.create({ ...defaultTable, ...tableData });
  return table;
};

const createTestReservation = async (reservationData = {}) => {
  const defaultDate = reservationData.date || getFutureDate(3);
  const isPastDate = new Date(defaultDate) < new Date().setHours(0, 0, 0, 0);

  const defaultReservation = {
    userId: reservationData.userId,
    userEmail: reservationData.userEmail || 'test@example.com',
    userName: reservationData.userName || 'Test User',
    date: defaultDate,
    slot: reservationData.slot || 12, // 12:00
    guests: reservationData.guests || 2,
    tableNumber: reservationData.tableNumber || [1],
    contactPhone: reservationData.contactPhone || '0612345678',
    status: reservationData.status || 'confirmed',
    specialRequest: reservationData.specialRequest || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Bypass validation for past dates (used for testing historical data)
  if (isPastDate) {
    const result = await Reservation.collection.insertOne(defaultReservation);
    const reservation = await Reservation.findById(result.insertedId);
    return reservation;
  }

  const reservation = await Reservation.create(defaultReservation);
  return reservation;
};

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  createTestOrder,
  createTestTable,
  createTestReservation,
  getFutureDate,
  generateAuthToken,
  mockRequest,
  mockResponse,
  mockNext,
};