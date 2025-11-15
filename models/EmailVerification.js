const mongoose = require('mongoose');
const crypto = require('crypto');

const EmailVerificationSchema = new mongoose.Schema({
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
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
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
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to generate verification token
EmailVerificationSchema.statics.createToken = async function(userId, email) {
  // Delete any existing tokens for this user
  await this.deleteMany({ userId });

  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');

  // Create new verification token
  const verification = await this.create({
    userId,
    email,
    token,
  });

  return verification;
};

// Method to verify if token is still valid
EmailVerificationSchema.methods.isValid = function() {
  return !this.used && this.expiresAt > new Date();
};

// Method to mark token as used (OWASP: one-time use)
EmailVerificationSchema.methods.markAsUsed = async function() {
  this.used = true;
  await this.save();
};

module.exports = mongoose.model('EmailVerification', EmailVerificationSchema);
