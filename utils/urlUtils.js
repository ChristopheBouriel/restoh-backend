/**
 * URL Utilities
 * Centralized URL building to handle edge cases (trailing slashes, etc.)
 */

/**
 * Get the frontend base URL (without trailing slash)
 * @returns {string} Frontend URL
 */
const getFrontendUrl = () => {
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  // Remove trailing slash if present
  return url.replace(/\/+$/, '');
};

/**
 * Build a frontend URL with the given path
 * @param {string} path - Path to append (e.g., '/verify-email/token123')
 * @returns {string} Full URL
 */
const buildFrontendUrl = (path) => {
  const baseUrl = getFrontendUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

module.exports = {
  getFrontendUrl,
  buildFrontendUrl,
};
