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
const SESSION_EXPIRE_HOURS = parseInt(process.env.SESSION_EXPIRE_HOURS, 10) || 24; // When rememberMe is false

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
 * Generate a refresh token and store it in database
 * Duration depends on rememberMe option:
 * - rememberMe: true → REFRESH_TOKEN_EXPIRE_DAYS (default 7 days)
 * - rememberMe: false → SESSION_EXPIRE_HOURS (default 24 hours)
 *
 * @param {string} userId - User ID
 * @param {Object} req - Express request object (for userAgent and IP)
 * @param {boolean} rememberMe - Whether to use long-lived token
 * @returns {Promise<string>} Refresh token string
 */
const generateRefreshToken = async (userId, req = null, rememberMe = true) => {
  const expireDays = rememberMe ? REFRESH_TOKEN_EXPIRE_DAYS : SESSION_EXPIRE_HOURS / 24;
  const refreshToken = await RefreshToken.createToken(userId, req, expireDays);
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
 * @param {boolean} rememberMe - Whether to use long-lived cookie
 * @returns {Object} Cookie options
 */
const getRefreshTokenCookieOptions = (rememberMe) => {
  const maxAge = rememberMe
    ? REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
    : SESSION_EXPIRE_HOURS * 60 * 60 * 1000;

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/api/auth', // Only sent to auth routes
  };
};

/**
 * Set refresh token cookie on response
 * @param {Object} res - Express response object
 * @param {string} token - Refresh token
 * @param {boolean} rememberMe - Whether to use long-lived cookie
 */
const setRefreshTokenCookie = (res, token, rememberMe = true) => {
  res.cookie('refreshToken', token, getRefreshTokenCookieOptions(rememberMe));
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
    sessionExpireHours: SESSION_EXPIRE_HOURS,
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
  SESSION_EXPIRE_HOURS,
};
