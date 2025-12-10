/**
 * Global mock setup - runs BEFORE test environment
 * This file is loaded via setupFiles in jest.config.js
 *
 * Mocks external services that would cause tests to hang or fail:
 * - cloudinaryUpload: Multer middleware that waits for file uploads
 * - emailService: Brevo email service that would send real emails
 */

// Mock cloudinaryUpload middleware globally
jest.mock('../middleware/cloudinaryUpload', () => ({
  uploadMenuImage: jest.fn((req, res, next) => next()),
  uploadAvatar: jest.fn((req, res, next) => next()),
  uploadRestaurantImage: jest.fn((req, res, next) => next()),
  deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
  getOptimizedUrl: jest.fn((publicId) => `https://cloudinary.com/${publicId}`),
  cloudinary: {
    uploader: {
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
    url: jest.fn((publicId) => `https://cloudinary.com/${publicId}`),
  },
}));

// Mock emailService globally to prevent sending real emails
jest.mock('../services/email/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-id' }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-id' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-id' }),
  sendNewsletterEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-id' }),
  sendPromotionEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-id' }),
  sendBulkEmails: jest.fn().mockResolvedValue({ success: 0, failed: 0, errors: [] }),
  loadTemplate: jest.fn().mockReturnValue('<html>Mock template</html>'),
}));
