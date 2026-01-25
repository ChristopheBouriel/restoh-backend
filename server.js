// Load environment variables FIRST (before any imports that depend on them)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { standardLimiter } = require('./middleware/rateLimiter');
const mongoSanitize = require('./middleware/mongoSanitize');
const logger = require('./utils/logger');

// Connect to MongoDB
connectDB();

const app = express();

// Trust proxy - Required for services behind reverse proxies (Render, Heroku, AWS ELB, etc.)
// This enables express-rate-limit to correctly identify users via X-Forwarded-For header
// Value of 1 means trust only the first proxy (the one closest to the app)
app.set('trust proxy', 1);

// Security middleware with comprehensive headers
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  // Cross-Origin Resource Policy - allow cross-origin for images/assets
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "http://localhost:3001", "https:"],
    },
  },

  // HTTP Strict Transport Security - only in production with HTTPS
  hsts: isProduction ? {
    maxAge: 31536000,        // 1 year in seconds
    includeSubDomains: true, // Apply to subdomains
    preload: true,           // Allow preload list inclusion
  } : false,

  // Referrer Policy - control referrer information
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // X-Frame-Options - prevent clickjacking
  frameguard: { action: 'deny' },

  // These are enabled by default in Helmet v7, but explicit for clarity:
  // - X-Content-Type-Options: nosniff (prevents MIME sniffing)
  // - X-DNS-Prefetch-Control: off (privacy)
  // - X-Download-Options: noopen (IE specific)
  // - X-Permitted-Cross-Domain-Policies: none (Flash/PDF policies)
  // - X-XSS-Protection: 0 (deprecated, correctly disabled)
}));

// Global rate limiting - Active in all environments (relaxed in development)
app.use('/api/', standardLimiter);

// CORS configuration - Environment-aware origins
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

// Development origins (localhost only)
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

// Production origins from environment variable
const prodOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

// Fail fast in production if ALLOWED_ORIGINS is not set
if (isProduction && prodOrigins.length === 0) {
  logger.error('FATAL: ALLOWED_ORIGINS must be set in production');
  logger.error('Example: ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com');
  process.exit(1);
}

const allowedOrigins = isProduction ? prodOrigins : devOrigins;

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);

    // In development, allow all origins for easier testing
    if (isDevelopment) {
      return callback(null, true);
    }

    // In production, strictly check against allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Body parsing middleware with size limits to prevent DoS
app.use(express.json({ limit: '100kb' }));  // 100kb for JSON (reviews, orders, etc.)
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// MongoDB injection protection - sanitize all inputs
app.use(mongoSanitize);

// Cookie parsing middleware
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


// Health check route (production-ready for Docker/Kubernetes)
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    checks: {
      database: 'ok'
    }
  };

  try {
    // Check MongoDB connection state
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      health.status = 'degraded';
      health.checks.database = dbState === 0 ? 'disconnected' : 'connecting';
    }
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// CORS test route
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin,
    method: req.method,
    headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/newsletter', require('./routes/newsletterRoutes'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/review', require('./routes/review'));
app.use('/api/restaurant', require('./routes/restaurant'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/contact', require('./routes/contact'));

// Handle undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Promise Rejection: ${err.message}`);
  console.error(err.stack);

  // In development, log but don't crash - allows debugging
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.error('⚠️  Server continuing despite unhandled rejection (development mode)');
    return;
  }

  // In production, close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  console.error(err.stack);

  // In development, log but don't crash
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.error('⚠️  Server continuing despite uncaught exception (development mode)');
    return;
  }

  // In production, exit immediately
  process.exit(1);
});

module.exports = app;