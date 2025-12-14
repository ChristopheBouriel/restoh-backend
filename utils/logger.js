/**
 * Safe logger utility that sanitizes sensitive data
 * Prevents accidental exposure of passwords, tokens, etc. in logs
 */

const sensitiveKeys = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'bearer'
];

/**
 * Recursively sanitize an object by redacting sensitive fields
 * @param {any} obj - Object to sanitize
 * @param {number} depth - Current recursion depth (prevents infinite loops)
 * @returns {any} Sanitized object
 */
const sanitize = (obj, depth = 0) => {
  // Prevent infinite recursion
  if (depth > 5) return '[MAX_DEPTH]';

  // Handle null/undefined
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }

  // Handle objects
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key contains sensitive data
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Check if we're in development mode
 */
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

/**
 * Logger with different verbosity based on environment
 */
const logger = {
  /**
   * Info level - only logs in development
   */
  info: (message, data) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(`[INFO] ${message}`, sanitize(data));
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  },

  /**
   * Debug level - only logs in development, more verbose
   */
  debug: (message, data) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(`[DEBUG] ${message}`, sanitize(data));
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  },

  /**
   * Warning level - always logs
   */
  warn: (message, data) => {
    if (data !== undefined) {
      console.warn(`[WARN] ${message}`, sanitize(data));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  /**
   * Error level - always logs, sanitizes data
   */
  error: (message, data) => {
    if (data !== undefined) {
      // For errors, we want to preserve the error message but sanitize any data
      if (data instanceof Error) {
        console.error(`[ERROR] ${message}`, {
          message: data.message,
          stack: isDev ? data.stack : undefined
        });
      } else {
        console.error(`[ERROR] ${message}`, sanitize(data));
      }
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },

  /**
   * Success level - only logs in development
   */
  success: (message, data) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(`[SUCCESS] ✅ ${message}`, sanitize(data));
      } else {
        console.log(`[SUCCESS] ✅ ${message}`);
      }
    }
  }
};

module.exports = logger;
module.exports.sanitize = sanitize;
