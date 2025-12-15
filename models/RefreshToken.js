const mongoose = require('mongoose');
const crypto = require('crypto');

const RefreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  // Device/session info for security monitoring
  userAgent: {
    type: String,
    default: null,
  },
  ip: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL Index: MongoDB automatically deletes expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for fast lookup by userId (for logout-all)
RefreshTokenSchema.index({ userId: 1 });

// Static method to create a new refresh token
RefreshTokenSchema.statics.createToken = async function(userId, req, expireDays = 7) {
  // Generate secure random token (64 bytes = 128 hex chars)
  const token = crypto.randomBytes(64).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expireDays);

  // Create new refresh token
  const refreshToken = await this.create({
    token,
    userId,
    expiresAt,
    userAgent: req?.get?.('User-Agent') || null,
    ip: req?.ip || req?.connection?.remoteAddress || null,
  });

  return refreshToken;
};

// Static method to verify a refresh token
RefreshTokenSchema.statics.verifyToken = async function(token) {
  const refreshToken = await this.findOne({ token });

  if (!refreshToken) {
    return null;
  }

  // Check if expired (belt and suspenders - TTL should handle this)
  if (refreshToken.expiresAt < new Date()) {
    await this.deleteOne({ token });
    return null;
  }

  return refreshToken;
};

// Static method to revoke a specific token
RefreshTokenSchema.statics.revokeToken = async function(token) {
  const result = await this.deleteOne({ token });
  return result.deletedCount > 0;
};

// Static method to revoke all tokens for a user (logout everywhere)
RefreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  const result = await this.deleteMany({ userId });
  return result.deletedCount;
};

// Static method to get all active sessions for a user
RefreshTokenSchema.statics.getUserSessions = async function(userId) {
  return this.find({ userId }).select('userAgent ip createdAt').sort({ createdAt: -1 });
};

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
