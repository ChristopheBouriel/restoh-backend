# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **restOh-back**, a Node.js/Express backend API for the RestOh Restaurant Web Application. It provides comprehensive restaurant management features including menu management, order processing, reservations, user authentication, and payment integration.

## Development Commands

### Core Development
- **Start server**: `npm start` (production) or `npm run dev` (development with nodemon)
- **Debug mode**: `npm run dev:debug` (with Node.js inspector)
- **Environment**: Requires Node.js >=14.0.0

### Database Setup
The application uses MongoDB for data persistence:
- **With MongoDB**: Set `MONGODB_URI` in .env file for persistent storage
- **Without MongoDB**: Application handles connection failures gracefully and continues running (development mode)

## Architecture Overview

### MVC Structure
```
├── config/           # Database configuration
├── controllers/      # Business logic handlers
├── data/            # JSON file storage (when MongoDB unavailable)
├── middleware/      # Authentication & error handling
├── models/          # MongoDB schemas (Mongoose)
├── routes/          # API endpoint definitions
├── utils/           # Utility functions and helpers
└── server.js        # Main application entry point
```

### Key Architectural Patterns

#### Database Architecture
The application uses MongoDB with Mongoose ODM:
- **Connection handling**: Graceful error management in `config/database.js`
- **Development mode**: Continues running if MongoDB is unavailable
- **Production mode**: Exits on database connection failure

#### Authentication & Authorization
- JWT-based authentication with `middleware/auth.js`
- Role-based access control (admin/user roles)
- Supports temporary in-memory storage for development without database

#### API Structure
All endpoints follow `/api/{resource}` pattern:
- `/api/auth` - Authentication (login, register, profile)
- `/api/menu` - Menu management + nested reviews endpoints
- `/api/review` - Individual review operations (update, delete)
- `/api/orders` - Order processing
- `/api/reservations` - Table reservations
- `/api/payments` - Payment processing (Stripe)
- `/api/users` - User management
- `/api/admin` - Administrative functions
- `/api/contact` - Contact form handling

#### Reviews & Ratings Architecture

**Data Model**: Reviews are **embedded documents** within MenuItem (not a separate collection)

**Rationale** (aligned with MongoDB best practices 2024):
- ✅ Strong parent-child relationship (reviews belong to menu items)
- ✅ Bounded growth (realistic limit: ~1000 reviews per item)
- ✅ Data locality (improved read performance - 1 query instead of 2)
- ✅ Within MongoDB 16MB document limit (~60,000 reviews possible)

**Route Design Philosophy** (RESTful best practices 2024):

*Nested routes* - When parent context is essential:
```
POST   /api/menu/:menuItemId/review    # Create review (requires parent)
GET    /api/menu/:menuItemId/review    # List reviews (scoped to parent)
GET    /api/menu/:menuItemId/rating    # Get rating stats (parent property)
```

*Flat routes* - For individual resource operations:
```
PUT    /api/review/:reviewId            # Update review (ID is sufficient)
DELETE /api/review/:reviewId            # Delete review (no parent needed)
```

**Benefits of this hybrid approach**:
- Avoids redundant validation (menuItemId ↔ reviewId)
- Simplifies update/delete operations
- Prevents overly nested URLs (max 2 levels)
- Follows "Avoid nesting beyond 2-3 levels" (Stack Overflow, Moesif 2024)

**Schema**:
```javascript
MenuItem.reviews: [{
  user: ObjectId (ref: User),
  rating: Number (1-5),
  comment: String (max 500 chars),
  createdAt: Date
}]
MenuItem.rating: {
  average: Number (0-5),
  count: Number
}
```

### Payment Integration
- **Stripe**: Card payments with webhook support
- **COD**: Cash on delivery option
- Test mode configured by default (see PAYMENT_SETUP_GUIDE.md)

### Security Features
- Helmet.js for security headers
- Rate limiting (100 requests per 15 minutes per IP)
- CORS configuration for multiple frontend origins
- Password hashing with bcryptjs
- Input validation with Joi

### Error Handling
- Global error handler in `middleware/errorHandler.js`
- Async wrapper utility in `utils/asyncHandler.js`
- Custom error response utility in `utils/errorResponse.js`

## Data Models

### Core Entities
- **User**: Authentication, profiles, preferences, addresses
- **MenuItem**: Menu items with categories, pricing, availability, **embedded reviews**
- **Order**: Order processing with items, payment status, delivery
- **Reservation**: Table booking system with time slots

### Reviews Data Model
Reviews are **embedded** within MenuItem documents:
- **One review per user per item** (UNIQUE constraint)
- **Automatic rating calculation** via `calculateAverageRating()` method
- **Populate user data** on read operations (firstName, lastName, avatar)

### User Roles
- **user**: Regular customers (order, reserve, profile management)
- **admin**: Full access to all resources and admin panel

## Development Notes

### Environment Configuration
- Copy `.env.example` to `.env` and configure
- Essential variables: `JWT_SECRET`, `JWT_EXPIRE`, `MONGODB_URI`
- Payment gateways: `STRIPE_SECRET_KEY`

### Testing Without Database
- Application automatically handles MongoDB connection failures gracefully
- Continues running in development mode (logs warning)
- Exits in production mode for data integrity

### File Upload Handling
- Cloudinary integration for image storage
- Multer middleware for file uploads
- Avatar uploads for user profiles

### API Response Format
Consistent response structure across all endpoints:
```json
{
  "success": boolean,
  "message": string,
  "data": object/array
}
```

### Development Workflow
1. MongoDB is optional - app works with or without it
2. Payment system starts in test mode (no real charges)
3. CORS configured for multiple localhost ports (3000, 3001, 3002)
4. Rate limiting applies only to `/api/` routes