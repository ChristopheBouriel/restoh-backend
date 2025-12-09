/**
 * Manual mock for cloudinaryUpload middleware
 * Used by Jest when jest.mock('../../middleware/cloudinaryUpload') is called
 *
 * This mock bypasses the actual multer/cloudinary upload process
 * and simply calls next() to continue the request chain.
 */

// Mock middleware that just passes through
const uploadMenuImage = jest.fn((req, res, next) => next());
const uploadAvatar = jest.fn((req, res, next) => next());

// Mock cloudinary delete function
const deleteImage = jest.fn().mockResolvedValue({ result: 'ok' });

module.exports = {
  uploadMenuImage,
  uploadAvatar,
  deleteImage,
};
