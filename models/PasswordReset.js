const mongoose = require('mongoose');
const crypto = require('crypto');

const PasswordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  },
  used: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for automatic cleanup of expired tokens
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to generate reset token
PasswordResetSchema.statics.createToken = async function(userId, email) {
  // Delete any existing unused tokens for this user
  await this.deleteMany({ userId, used: false });

  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');

  // Create new reset token
  const resetToken = await this.create({
    userId,
    email,
    token,
  });

  return resetToken;
};

// Method to verify if token is still valid
PasswordResetSchema.methods.isValid = function() {
  return !this.used && this.expiresAt > new Date();
};

// Method to mark token as used
PasswordResetSchema.methods.markAsUsed = async function() {
  this.used = true;
  await this.save();
};

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
