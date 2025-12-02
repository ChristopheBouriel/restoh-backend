const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a menu item name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters'],
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price cannot be negative'],
  },
  image: {
    type: String,
    default: null,
  },
  cloudinaryPublicId: {
    type: String,
    default: null,
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: {
      values: ['appetizer', 'main', 'dessert', 'beverage'],
      message: 'Category must be appetizer, main, dessert, or beverage',
    },
  },
  cuisine: {
    type: String,
    enum: {
      values: ['asian', 'lao', 'continental'],
      message: 'Please select a valid cuisine type',
    },
    default: null,
  },
  isVegetarian: {
    type: Boolean,
    default: null,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  ingredients: [{
    type: String,
    trim: true,
  }],
  allergens: [{
    type: String,
    trim: true,
  }],
  preparationTime: {
    type: Number, // in minutes
    default: 15,
    min: [1, 'Preparation time must be at least 1 minute'],
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5'],
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  reviews: [{
    user: {
      id: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
      },
      name: {
        type: String,
        required: true,
      }
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: [200, 'Review cannot be more than 200 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  isPopular: {
    type: Boolean,
    default: false,
  },
  isPopularOverride: {
    type: Boolean,
    default: false,  // false = participe au calcul auto, true = exclu
  },
  isSuggested: {
    type: Boolean,
    default: false,  // true = suggestion du restaurant
  },
  orderCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;

      // Transform reviews structure for frontend
      if (ret.reviews && Array.isArray(ret.reviews)) {
        ret.reviews = ret.reviews.map(review => {
          const userId = review.user?._id || review.user;
          const userName = review.name;

          return {
            id: review._id,
            user: {
              id: userId.toString(),
              name: userName
            },
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt
          };
        });
      }

      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;

      // Transform reviews structure for frontend
      if (ret.reviews && Array.isArray(ret.reviews)) {
        ret.reviews = ret.reviews.map(review => {
          const userId = review.user?._id || review.user;
          const userName = review.name;

          return {
            id: review._id,
            user: {
              id: userId.toString(),
              name: userName
            },
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt
          };
        });
      }

      return ret;
    }
  }
});

// Create index for search functionality
MenuItemSchema.index({ name: 'text', description: 'text' });

// Index for popular items query (by category, excluding overridden, sorted by orderCount)
MenuItemSchema.index({ category: 1, isPopularOverride: 1, orderCount: -1 });

// Index for suggested items query
MenuItemSchema.index({ isSuggested: 1 });

// Calculate average rating
MenuItemSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
  } else {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating.average = Math.round((sum / this.reviews.length) * 10) / 10;
    this.rating.count = this.reviews.length;
  }
  return this.save();
};

module.exports = mongoose.model('MenuItem', MenuItemSchema);