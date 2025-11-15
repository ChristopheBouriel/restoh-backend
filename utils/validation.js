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
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    items: Joi.array().items(
      Joi.object({
        menuItem: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().positive().required(),
        specialInstructions: Joi.string().max(100).allow(null).optional(), // Not implemented yet
      })
    ).min(1).required(),
    totalPrice: Joi.number().positive().required(),
    orderType: Joi.string().valid('pickup', 'delivery').required(),
    paymentStatus: Joi.string().valid('pending', 'paid').required(),
    paymentMethod: Joi.string().valid('cash', 'card').required(),
    deliveryAddress: Joi.string().required(),
    specialInstructions: Joi.string().max(200).allow(null).optional(),
  });

  return schema.validate(data);
};

// Contact form validation
const contactSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[+]?[0-9\s\-()]{10,15}$/).allow(null).optional(),
    subject: Joi.string().min(5).max(200).required(),
    message: Joi.string().min(10).max(1000).required(),
    status: Joi.string().valid('new', 'read', 'replied', 'newlyReplied', 'closed').optional()
});


// Discussion reply validation
const DiscussionSchema = Joi.object({
    userId: Joi.string().allow(null).optional(),
    name: Joi.string().min(2).max(100).allow(null).optional(),
    role: Joi.string().valid('admin', 'user').allow(null).optional(),
    text: Joi.string().min(1).max(1000).required(),
    date: Joi.date().allow(null).optional(),
    status: Joi.string().valid('new', 'read').allow(null).optional()
});

// User profile update validation
const validateUserUpdate = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).allow(null).optional(),
    address: Joi.object({
      street: Joi.string().max(100).allow(null).optional(),
      city: Joi.string().max(50).allow(null).optional(),
      state: Joi.string().max(50).allow(null).optional(),
      zipCode: Joi.string().pattern(/^[0-9]{5}$/).allow(null).optional(),
    }).optional(),
    notifications: Joi.object({
      newsletter: Joi.boolean().optional(),
      promotions: Joi.boolean().optional(),
    }).optional(),
    currentPassword: Joi.string().min(6).optional(),
    newPassword: Joi.string().min(6).optional(),
  }).custom((value, helpers) => {
    // If newPassword is provided, currentPassword must also be provided
    if (value.newPassword && !value.currentPassword) {
      return helpers.error('any.invalid', {
        message: 'Current password is required to set a new password'
      });
    }
    return value;
  });

  return schema.validate(data);
};

// Admin user update validation (only role and active status)
const validateAdminUserUpdate = (data) => {
  const schema = Joi.object({
    role: Joi.string().valid('user', 'admin').optional(),
    isActive: Joi.boolean().optional(),
  });

  return schema.validate(data);
};

module.exports = {
  validateRegister,
  validateLogin,
  menuSchema,
  validateReservation,
  validateOrder,
  contactSchema,
  DiscussionSchema,
  validateUserUpdate,
  validateAdminUserUpdate,
};