const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check for token in cookies first (secure method)
  if (req.cookies.token) {
    token = req.cookies.token;
  }
  // Fallback to authorization header for backward compatibility
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token || token === 'none') {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from MongoDB
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // OWASP Security: Check if password was changed after token was issued
    if (req.user.passwordChangedAt) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (req.user.passwordChangedAt > tokenIssuedAt) {
        return res.status(401).json({
          success: false,
          message: 'Password was changed recently. Please log in again.',
        });
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Optional authentication - sets req.user if token exists but doesn't block if missing
const optionalAuth = async (req, res, next) => {
  let token;

  // Check for token in cookies first
  if (req.cookies.token) {
    token = req.cookies.token;
  }
  // Fallback to authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token or token is 'none', just continue without setting req.user
  if (!token || token === 'none') {
    return next();
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from MongoDB
    req.user = await User.findById(decoded.id).select('-password');

    // Continue even if user not found (just without req.user)
    next();
  } catch (error) {
    // Continue even if token is invalid (just without req.user)
    next();
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, optionalAuth, authorize };