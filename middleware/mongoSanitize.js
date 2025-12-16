const mongoSanitize = require('mongo-sanitize');

/**
 * Middleware to sanitize all incoming data against MongoDB injection attacks.
 * Removes any keys starting with '$' or containing '.' from req.body, req.query, and req.params.
 * This prevents NoSQL injection attacks like { "$gt": "" } or { "field.$where": "..." }
 */
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = mongoSanitize(req.body);
  }
  if (req.query) {
    req.query = mongoSanitize(req.query);
  }
  if (req.params) {
    req.params = mongoSanitize(req.params);
  }
  next();
};

module.exports = sanitizeMiddleware;
