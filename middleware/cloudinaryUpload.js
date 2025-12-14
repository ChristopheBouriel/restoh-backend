const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('../utils/logger');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage configuration avec transformations
const createCloudinaryStorage = (folder, transformations = {}) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 800, height: 600, crop: 'limit', quality: 'auto' },
        { format: 'auto' },
        ...transformations
      ],
    },
  });
};

// Configurations spécifiques par type
const storageConfigs = {
  menuItems: createCloudinaryStorage('restoh/menu-items', [
    { width: 600, height: 400, crop: 'fill', gravity: 'center' }
  ]),
  avatars: createCloudinaryStorage('restoh/avatars', [
    { width: 200, height: 200, crop: 'fill', gravity: 'face' }
  ]),
  restaurants: createCloudinaryStorage('restoh/restaurants', [
    { width: 1200, height: 800, crop: 'fill' }
  ])
};

// Middleware factory
const createUploadMiddleware = (type = 'menuItems', fieldName = 'image') => {
  const upload = multer({
    storage: storageConfigs[type],
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
      // Validation des types MIME
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG ou WebP.'), false);
      }
    },
  });

  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      // Si fichier uploadé, ajouter l'URL Cloudinary
      if (req.file) {
        // Avec multer-storage-cloudinary, l'URL est dans req.file.path
        // et le public_id est dans req.file.filename
        req.body.image = req.file.path; // Cloudinary URL
        req.body.cloudinaryPublicId = req.file.filename; // Pour la suppression
        req.cloudinaryPublicId = req.file.filename; // Pour middleware

        // Cleanup de l'ancienne image si c'est une mise à jour
        if (req.body.oldImagePublicId) {
          cloudinary.uploader.destroy(req.body.oldImagePublicId)
            .catch(err => logger.warn('Error deleting old image', { error: err.message }));
        }

        logger.debug('Image uploaded to Cloudinary', { filename: req.file.filename });
      }

      next();
    });
  };
};

// Utilitaires
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    logger.error('Error deleting from Cloudinary', { publicId, error: error.message });
    throw error;
  }
};

const getOptimizedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    ...transformations,
    secure: true,
    quality: 'auto',
    format: 'auto'
  });
};

module.exports = {
  uploadMenuImage: createUploadMiddleware('menuItems', 'image'),
  uploadAvatar: createUploadMiddleware('avatars', 'avatar'),
  uploadRestaurantImage: createUploadMiddleware('restaurants', 'image'),
  deleteImage,
  getOptimizedUrl,
  cloudinary,
};