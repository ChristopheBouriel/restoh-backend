/**
 * Global mock setup - runs BEFORE test environment
 * This file is loaded via setupFiles in jest.config.js
 *
 * Mocks external services that would cause tests to hang or fail:
 * - cloudinaryUpload: Multer middleware that waits for file uploads
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
