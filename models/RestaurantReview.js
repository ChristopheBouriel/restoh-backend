const mongoose = require('mongoose');

const RestaurantReviewSchema = new mongoose.Schema({
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
  ratings: {
    overall: {
      type: Number,
      required: true,
      min: [1, 'Overall rating must be at least 1'],
      max: [5, 'Overall rating cannot exceed 5'],
    },
    service: {
      type: Number,
      default: null,
      min: [1, 'Service rating must be at least 1'],
      max: [5, 'Service rating cannot exceed 5'],
    },
    ambiance: {
      type: Number,
      default: null,
      min: [1, 'Ambiance rating must be at least 1'],
      max: [5, 'Ambiance rating cannot exceed 5'],
    },
    food: {
      type: Number,
      default: null,
      min: [1, 'Food rating must be at least 1'],
      max: [5, 'Food rating cannot exceed 5'],
    },
    value: {
      type: Number,
      default: null,
      min: [1, 'Value rating must be at least 1'],
      max: [5, 'Value rating cannot exceed 5'],
    }
  },
  comment: {
    type: String,
    maxlength: [500, 'Comment cannot exceed 500 characters'],
  },
  visitDate: {
    type: Date,
    default: null,
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for efficient queries
RestaurantReviewSchema.index({ 'user.id': 1 });
RestaurantReviewSchema.index({ createdAt: -1 });

// Static method to calculate overall statistics
RestaurantReviewSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        avgOverall: { $avg: '$ratings.overall' },
        avgService: { $avg: '$ratings.service' },
        avgAmbiance: { $avg: '$ratings.ambiance' },
        avgFood: { $avg: '$ratings.food' },
        avgValue: { $avg: '$ratings.value' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalReviews: 0,
      ratings: {
        overall: { average: 0, count: 0 },
        service: { average: 0, count: 0 },
        ambiance: { average: 0, count: 0 },
        food: { average: 0, count: 0 },
        value: { average: 0, count: 0 }
      }
    };
  }

  const result = stats[0];

  // Count non-null values for each category
  const counts = await this.aggregate([
    {
      $group: {
        _id: null,
        serviceCount: {
          $sum: { $cond: [{ $ne: ['$ratings.service', null] }, 1, 0] }
        },
        ambianceCount: {
          $sum: { $cond: [{ $ne: ['$ratings.ambiance', null] }, 1, 0] }
        },
        foodCount: {
          $sum: { $cond: [{ $ne: ['$ratings.food', null] }, 1, 0] }
        },
        valueCount: {
          $sum: { $cond: [{ $ne: ['$ratings.value', null] }, 1, 0] }
        }
      }
    }
  ]);

  const countResult = counts[0] || {};

  return {
    totalReviews: result.totalReviews,
    ratings: {
      overall: {
        average: Math.round(result.avgOverall * 10) / 10,
        count: result.totalReviews
      },
      service: {
        average: result.avgService ? Math.round(result.avgService * 10) / 10 : 0,
        count: countResult.serviceCount || 0
      },
      ambiance: {
        average: result.avgAmbiance ? Math.round(result.avgAmbiance * 10) / 10 : 0,
        count: countResult.ambianceCount || 0
      },
      food: {
        average: result.avgFood ? Math.round(result.avgFood * 10) / 10 : 0,
        count: countResult.foodCount || 0
      },
      value: {
        average: result.avgValue ? Math.round(result.avgValue * 10) / 10 : 0,
        count: countResult.valueCount || 0
      }
    }
  };
};

module.exports = mongoose.model('RestaurantReview', RestaurantReviewSchema);
