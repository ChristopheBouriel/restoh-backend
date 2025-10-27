const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Reservation must belong to a user'],
  },
  userEmail: {
    type: String,
    required: [true, 'User must have an email'],
  },
  userName: {
    type: String,
    required: [true, 'User must have a name'],
  },
  reservationNumber: {
    type: String,
    unique: true,
  },
  date: {
    type: Date,
    required: [true, 'Please add a reservation date'],
    validate: {
      validator: function(value) {
        // Only validate date is not in past when creating new reservation
        // Allow admins to modify past reservations
        if (this.isNew) {
          return value >= new Date().setHours(0, 0, 0, 0);
        }
        return true;
      },
      message: 'Reservation date cannot be in the past',
    },
  },
  slot: {
    type: Number,
    required: [true, 'Please add a reservation slot'],
  },
  guests: {
    type: Number,
    required: [true, 'Please add number of guests'],
    min: [1, 'Number of guests must be at least 1'],
    max: [20, 'Number of guests cannot exceed 20'],
  },
  status: {
    type: String,
    enum: {
      values: ['confirmed', 'seated', 'completed', 'cancelled', 'no-show'],
      message: 'Please select a valid status',
    },
    default: 'confirmed',
  },
  tableNumber: [{
    type: Number,
    required: [true, 'Please select table(s)'],
    min: [1, 'Table number must be at least 1'],
    max: [22, 'Table number cannot exceed 22'],
  }],
  specialRequest: {
    type: String,
    maxlength: [200, 'Special request cannot exceed 200 characters'],
    default: null,
  },
  contactPhone: {
    type: String,
    required: [true, 'Please add a contact phone number'],
    match: [/^[0-9]{10}$/, 'Please add a valid phone number'],
  },
  notes: {
    type: String,
    maxlength: [300, 'Notes cannot exceed 300 characters'],
    default: null,
  },
}, {
  timestamps: true,
});

// Create compound index for date and time to prevent double booking
ReservationSchema.index({ date: 1, time: 1, tableNumber: 1 }, { unique: true, sparse: true });

// Generate reservation number before saving
ReservationSchema.pre('save', function(next) {
  if (!this.reservationNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.reservationNumber = `RES-${timestamp.slice(-6)}${random}`;
  }
  next();
});

// Complete reservation
ReservationSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Reservation', ReservationSchema);