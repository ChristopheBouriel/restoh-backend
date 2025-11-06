const Joi = require('joi');

// User registration validation
const validateRegister = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).allow(null).optional(),
  });

  return schema.validate(data);
};

// User login validation
const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  return schema.validate(data);
};

const menuSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().min(10).max(500).required(),
    price: Joi.number().positive().required(),
    category: Joi.string().valid('appetizer', 'main', 'dessert', 'beverage').required(),
    cuisine: Joi.string().valid('asian', 'lao', 'continental').allow(null).optional(),
    preparationTime: Joi.number().allow(null).optional(),
    isVegetarian: Joi.boolean().allow(null).optional(),
    isAvailable: Joi.boolean().optional(),
    ingredients: Joi.array().items(Joi.string()).optional(),
    allergens: Joi.array().items(Joi.string()).optional(),
    spiceLevel: Joi.string().valid('mild', 'medium', 'hot', 'very-hot').allow(null).optional(),
    image: Joi.string().allow(null).optional(),
    cloudinaryPublicId: Joi.string().allow(null).optional(),
  });

// Reservation validation
const validateReservation = (data) => {
  // Get start of today (midnight) in UTC to allow same-day reservations
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const schema = Joi.object({
    date: Joi.date().min(startOfToday).required(),
    slot: Joi.number().required(),
    guests: Joi.number().integer().min(1).max(20).required(),
    tableNumber: Joi.array().items(Joi.number().integer()).required(),
    specialRequest: Joi.string().max(200).allow(null).optional(),
    contactPhone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  });

  return schema.validate(data);
};

// Order validation
const validateOrder = (data) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    userEmail: Joi.string().email().required(),
    userName: Joi.string().required(),
    items: Joi.array().items(
      Joi.object({
        menuItem: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().positive().required(),
        specialInstructions: Joi.string().max(100).allow(null).optional(),
      })
    ).min(1).required(),
    totalPrice: Joi.number().positive().required(),
    orderType: Joi.string().valid('pickup', 'delivery').required(),
    paymentStatus: Joi.string().valid('pending', 'paid').required(),
    paymentMethod: Joi.string().valid('cash', 'card').required(),
    deliveryAddress: Joi.string().required(),
    notes: Joi.string().max(200).allow(null).optional(),
  });

  return schema.validate(data);
};

// Contact form validation
const validateContact = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[+]?[0-9\s\-()]{10,15}$/).allow(null).optional(),
    subject: Joi.string().min(5).max(200).required(),
    message: Joi.string().min(10).max(1000).required(),
  });

  return schema.validate(data);
};

module.exports = {
  validateRegister,
  validateLogin,
  menuSchema,
  validateReservation,
  validateOrder,
  validateContact,
};