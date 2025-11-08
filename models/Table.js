const mongoose = require('mongoose');

const tableBookingSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  bookedSlots: {
    type: [Number],
    default: [],
    validate: {
      validator: function(slots) {
        return slots.every(slot => slot >= 1 && slot <= 15);
      },
      message: 'Invalid slot number. Slots must be between 1 and 15.'
    }
  }
}, {
  _id: false
});

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: Number,
    required: [true, 'Table number is required'],
    unique: true,
    min: [1, 'Table number must be at least 1'],
    max: [22, 'Table number cannot exceed 22']
  },
  tableBookings: {
    type: [tableBookingSchema],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  capacity: {
    type: Number,
    default: 4,
    min: [1, 'Table capacity must be at least 1'],
    max: [12, 'Table capacity cannot exceed 12']
  },
  notes: {
    type: String,
    maxlength: [200, 'Notes cannot exceed 200 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

tableSchema.index({ tableNumber: 1 });
tableSchema.index({ 'tableBookings.date': 1 });

tableSchema.statics.initializeTables = async function() {
  const existingCount = await this.countDocuments();

  if (existingCount === 0) {
    const tables = [];
    for (let i = 1; i <= 22; i++) {
      tables.push({
        tableNumber: i,
        capacity: i <= 10 ? 4 : 6,
        tableBookings: []
      });
    }

    await this.insertMany(tables);
    console.log('✅ Initialized 22 tables successfully');
  }
};

module.exports = mongoose.model('Table', tableSchema);