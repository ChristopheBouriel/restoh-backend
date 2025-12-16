// Load environment variables FIRST (before any imports that depend on them)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { standardLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Connect to MongoDB
connectDB();

const app = express();

// Security middleware with relaxed img-src for development
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "http://localhost:3001", "https:"],
    },
  },
}));

// Global rate limiting - Active in all environments (relaxed in development)
app.use('/api/', standardLimiter);

// CORS configuration - Environment-aware origins
const isProduction = process.env.NODE_ENV === 'production';
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RestOh API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
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