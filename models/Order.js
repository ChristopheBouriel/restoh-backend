const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a user'],
    },
  userEmail: {
    type: String,
    required: [true, 'User must have an email'],
  },
  userName: {
    type: String,
    required: [true, 'User must have a name'],
  },
  orderNumber: {
    type: String,
    unique: true,
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.ObjectId,
      ref: 'MenuItem',
      required: [true, 'Please add a menu item'],
    },
    name: {
      type: String,
      required: [true, 'Please add name'],
    },
    quantity: {
      type: Number,
      required: [true, 'Please add quantity'],
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Please add item price'],
    },
    image: {
      type: String,
      required: [true, 'Please add image URL']
    },
    specialInstructions: {
      type: String,
      maxlength: [100, 'Special instructions cannot exceed 100 characters'],
    },
  }],
  totalPrice: {
    type: Number,
    required: [true, 'Please add total price'],
    min: [0, 'Total price cannot be negative'],
  },
  orderType: {
    type: String,
    required: [true, 'Please specify order type'],
    enum: {
      values: ['pickup', 'delivery'],
      message: 'Order type must be pickup or delivery',
    },
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled'],
      message: 'Please select a valid status',
    },
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid'],
      message: 'Please select a valid payment status',
    },
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card'],
    required: [true, 'Please specify payment method'],
  },
  deliveryAddress: {
    type: String,
    default: null,
  },
  notes: {
    type: String,
    maxlength: [200, 'Notes cannot exceed 200 characters'],
    default: null,
  },
}, {
  timestamps: true,
});

// Generate order number before saving
OrderSchema.pre('save', async function(next) {
    try {
      // Find the highest existing order number
      const lastOrder = await this.constructor.findOne({
        orderNumber: { $regex: /^ORD-\d{6}$/ }
      }).sort({ orderNumber: -1 });

      let nextNumber = 1;
      if (lastOrder && lastOrder.orderNumber) {
        // Extract number from ORD-XXXXXX format
        const currentNumber = parseInt(lastOrder.orderNumber.replace('ORD-', ''));
        nextNumber = currentNumber + 1;
      }

      this.orderNumber = `ORD-${nextNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      // Fallback to timestamp-based generation if database query fails
      const timestamp = Date.now().toString();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.orderNumber = `ORD-${timestamp.slice(-6)}${random}`;
    }
    next();
});

// Calculate estimated delivery time
OrderSchema.methods.calculateEstimatedDeliveryTime = function() {
  const baseTime = new Date();
  let additionalMinutes = 30; // Base preparation time

  // Add time based on order type
  if (this.orderType === 'delivery') {
    additionalMinutes += 20; // Additional delivery time
  } else if (this.orderType === 'pickup') {
    additionalMinutes += 10; // Additional packaging time
  }

  // Add time based on number of items
  additionalMinutes += this.items.length * 5;

  this.estimatedDeliveryTime = new Date(baseTime.getTime() + additionalMinutes * 60000);
  return this.save();
};

// Add index for performance on date-based queries
OrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);