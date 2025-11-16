const User = require('../models/User');
const emailService = require('../services/email/emailService');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Send newsletter to all subscribed users
// @route   POST /api/newsletter/send
// @access  Private/Admin
const sendNewsletter = asyncHandler(async (req, res) => {
  const { subject, content } = req.body;

  if (!subject || !content) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject and content',
    });
  }

  // Find all users who opted in for newsletter
  const subscribers = await User.find({
    'notifications.newsletter': true,
    isEmailVerified: true,
    isActive: true,
  }).select('name email');

  if (subscribers.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No subscribers found',
    });
  }

  // Prepare recipients
  const recipients = subscribers.map(user => ({
    email: user.email,
    name: user.name,
    variables: {
      content,
      unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe/newsletter/${user.id}`,
    },
  }));

  // Send bulk emails
  const results = await emailService.sendBulkEmails(recipients, subject, 'newsletter');

  res.status(200).json({
    success: true,
    message: 'Newsletter sent successfully',
    data: {
      totalSubscribers: subscribers.length,
      sent: results.success,
      failed: results.failed,
      errors: results.errors,
    },
  });
});

// @desc    Send promotion email to all subscribed users
// @route   POST /api/newsletter/promotion
// @access  Private/Admin
const sendPromotion = asyncHandler(async (req, res) => {
  const { subject, promotionContent } = req.body;

  if (!subject || !promotionContent) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject and promotion content',
    });
  }

  // Find all users who opted in for promotions
  const subscribers = await User.find({
    'notifications.promotions': true,
    isEmailVerified: true,
    isActive: true,
  }).select('name email');

  if (subscribers.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No subscribers found',
    });
  }

  // Prepare recipients
  const recipients = subscribers.map(user => ({
    email: user.email,
    name: user.name,
    variables: {
      promotionContent,
      unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe/promotions/${user.id}`,
    },
  }));

  // Send bulk emails
  const results = await emailService.sendBulkEmails(recipients, subject, 'promotion');

  res.status(200).json({
    success: true,
    message: 'Promotion email sent successfully',
    data: {
      totalSubscribers: subscribers.length,
      sent: results.success,
      failed: results.failed,
      errors: results.errors,
    },
  });
});

// @desc    Get newsletter statistics
// @route   GET /api/newsletter/stats
// @access  Private/Admin
const getNewsletterStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments({ isActive: true, isEmailVerified: true });
  const newsletterSubscribers = await User.countDocuments({
    'notifications.newsletter': true,
    isEmailVerified: true,
    isActive: true,
  });
  const promotionSubscribers = await User.countDocuments({
    'notifications.promotions': true,
    isEmailVerified: true,
    isActive: true,
  });

  res.status(200).json({
    success: true,
    data: {
      totalVerifiedUsers: totalUsers,
      newsletterSubscribers,
      promotionSubscribers,
      newsletterOptInRate: totalUsers > 0 ? ((newsletterSubscribers / totalUsers) * 100).toFixed(2) : 0,
      promotionOptInRate: totalUsers > 0 ? ((promotionSubscribers / totalUsers) * 100).toFixed(2) : 0,
    },
  });
});

// @desc    Unsubscribe from newsletter
// @route   GET /api/newsletter/unsubscribe/newsletter/:userId
// @access  Public
const unsubscribeNewsletter = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  user.notifications.newsletter = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Successfully unsubscribed from newsletter',
  });
});

// @desc    Unsubscribe from promotions
// @route   GET /api/newsletter/unsubscribe/promotions/:userId
// @access  Public
const unsubscribePromotions = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  user.notifications.promotions = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Successfully unsubscribed from promotions',
  });
});

module.exports = {
  sendNewsletter,
  sendPromotion,
  getNewsletterStats,
  unsubscribeNewsletter,
  unsubscribePromotions,
};
