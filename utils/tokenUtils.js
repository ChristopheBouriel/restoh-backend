/**
 * Token Utilities for Access Token + Refresh Token System
 *
 * Access Token: Short-lived JWT (15 min) - sent in Authorization header
 * Refresh Token: Long-lived random token (7 days) - stored in HttpOnly cookie + DB
 */

const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');

// Configuration with environment variable fallbacks
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS, 10) || 7;

/**
 * Generate a short-lived access token (JWT)
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRE }
  );
};

/**
 * Generate a long-lived refresh token and store it in database
 * @param {string} userId - User ID
 * @param {Object} req - Express request object (for userAgent and IP)
 * @returns {Promise<string>} Refresh token string
 */
const generateRefreshToken = async (userId, req = null) => {
  const refreshToken = await RefreshToken.createToken(userId, req, REFRESH_TOKEN_EXPIRE_DAYS);
  return refreshToken.token;
};

/**
 * Verify a refresh token exists and is valid
 * @param {string} token - Refresh token to verify
 * @returns {Promise<Object|null>} RefreshToken document or null if invalid
 */
const verifyRefreshToken = async (token) => {
  return RefreshToken.verifyToken(token);
};

/**
 * Revoke a specific refresh token
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<boolean>} True if token was revoked
 */
const revokeRefreshToken = async (token) => {
  return RefreshToken.revokeToken(token);
};

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of tokens revoked
 */
const revokeAllUserTokens = async (userId) => {
  return RefreshToken.revokeAllUserTokens(userId);
};

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of session info (userAgent, ip, createdAt)
 */
const getUserSessions = async (userId) => {
  return RefreshToken.getUserSessions(userId);
};

/**
 * Cookie options for refresh token
 * @returns {Object} Cookie options
 */
const getRefreshTokenCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth', // Only sent to auth routes
  };
};

/**
 * Set refresh token cookie on response
 * @param {Object} res - Express response object
 * @param {string} token - Refresh token
 */
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, getRefreshTokenCookieOptions());
};

/**
 * Clear refresh token cookie
 * @param {Object} res - Express response object
 */
const clearRefreshTokenCookie = (res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0),
    path: '/api/auth',
  });
};

/**
 * Decode access token without verifying (for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
const decodeAccessToken = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

/**
 * Get configuration info (for debugging/logging)
 * @returns {Object} Token configuration
 */
const getTokenConfig = () => {
  return {
    accessTokenExpire: ACCESS_TOKEN_EXPIRE,
    refreshTokenExpireDays: REFRESH_TOKEN_EXPIRE_DAYS,
  };
};

module.exports = {
  // Token generation
  generateAccessToken,
  generateRefreshToken,

  // Token verification
  verifyRefreshToken,
  decodeAccessToken,

  // Token revocation
  revokeRefreshToken,
  revokeAllUserTokens,

  // Session management
  getUserSessions,

  // Cookie helpers
  getRefreshTokenCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,

  // Configuration
  getTokenConfig,
  ACCESS_TOKEN_EXPIRE,
  REFRESH_TOKEN_EXPIRE_DAYS,
};
