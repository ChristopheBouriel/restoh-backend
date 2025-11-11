const Contact = require('../models/Contact');
const asyncHandler = require('../utils/asyncHandler');
const {
  contactSchema,
  DiscussionSchema
} = require('../utils/validation');
const {
  createContactMessageNotFoundError,
  createValidationError
} = require('../utils/errorHelpers');

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
const submitContactForm = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = validateContact(req.body);
  if (error) {
    const errorResponse = createValidationError(error.details[0].message, {
      field: error.details[0].path.join('.'),
      message: error.details[0].message
    });
    return res.status(400).json(errorResponse);
  }

  const { name, email, phone, subject, message } = req.body;

  // Create contact message in MongoDB
  const contactMessage = await Contact.create({
    name,
    email,
    phone,
    subject,
    message,
    status: 'new'
  });

  // TODO: In production, implement:
  // 1. Send email notification to admin
  // 2. Send confirmation email to user

  console.log('📧 New contact form submission:');
  console.log(`From: ${name} (${email})`);
  console.log(`Phone: ${phone || 'N/A'}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);

  res.status(200).json({
    success: true,
    message: 'Thank you for your message! We will get back to you soon.',
    data: {
      id: contactMessage._id,
      submittedAt: contactMessage.createdAt,
    },
  });
});

// @desc    Get user's own contact messages
// @route   GET /api/contact/my-messages
// @access  Private
const getUserContactMessages = asyncHandler(async (req, res) => {
  const messages = await Contact.find({ email: req.user.email })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages,
  });
});

// @desc    Get all contact messages (Admin only)
// @route   GET /api/contact/admin/messages
// @access  Private/Admin
const getContactMessages = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  let query = {};

  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }

  const total = await Contact.countDocuments(query);
  const messages = await Contact.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  // Pagination info
  const pagination = {};
  if (startIndex + limit < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pagination,
    data: messages,
  });
});

// @desc    Update contact message status (Admin only)
// @route   PATCH /api/contact/admin/messages/:id/status
// @access  Private/Admin
const updateContactMessageStatus = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = contactSchema.extract('status').validate(req.body.status);

  if (error) {
    const errorResponse = createValidationError(error.details[0].message, {
      field: 'status',
      message: error.details[0].message
    });
    return res.status(400).json(errorResponse);
  }

  const { status } = req.body;

  // Find the contact message
  const message = await Contact.findById(req.params.id);

  if (!message) {
    const errorResponse = createContactMessageNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Update status
  message.status = status;
  await message.save();

  res.status(200).json({
    success: true,
    message: 'Contact message status updated successfully',
    data: message,
  });
});

// @desc    Add reply to contact message discussion
// @route   PATCH /api/contact/:id/reply
// @access  Private (user can only reply to their own message, admin can reply to any)
const addReplyToDiscussion = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = DiscussionSchema.validate(req.body);
  if (error) {
    const errorResponse = createValidationError(error.details[0].message, {
      field: error.details[0].path.join('.'),
      message: error.details[0].message
    });
    return res.status(400).json(errorResponse);
  }

  const { text } = req.body;

  // Find the contact message
  const message = await Contact.findById(req.params.id);

  if (!message) {
    const errorResponse = createContactMessageNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Check permissions: user can only reply to their own message, admin can reply to any
  if (req.user.role !== 'admin' && message.email !== req.user.email) {
    return res.status(403).json({
      success: false,
      error: 'You can only reply to your own contact messages',
      code: 'FORBIDDEN'
    });
  }

  // Add reply to discussion
  const reply = {
    text: text.trim(),
    date: new Date(),
    from: req.user.name,
    status: 'new'
  };

  message.discussion.push(reply);

  // Update status based on who is replying
  if (req.user.role === 'admin') {
    // Admin replied
    message.status = 'replied';
  } else {
    // User replied - notify admin
    message.status = 'newlyReplied';
  }

  await message.save();

  res.status(200).json({
    success: true,
    message: 'Reply added successfully',
    data: {
      discussion: message.discussion,
      status: message.status
    }
  });
});

// @desc    Mark discussion message as read
// @route   PATCH /api/contact/:id/discussion/:discussionId/status
// @access  Private (user can mark admin messages, admin can mark user messages)
const markDiscussionMessageAsRead = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = DiscussionSchema.extract('status').validate(req.body.status);
  if (error) {
    const errorResponse = createValidationError(error.details[0].message, {
      field: 'status',
      message: error.details[0].message
    });
    return res.status(400).json(errorResponse);
  }

  // Find the contact message
  const message = await Contact.findById(req.params.id);

  if (!message) {
    const errorResponse = createContactMessageNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  // Check permissions: user can only access their own message, admin can access any
  if (req.user.role !== 'admin' && message.email !== req.user.email) {
    return res.status(403).json({
      success: false,
      error: 'You can only access your own contact messages',
      code: 'FORBIDDEN'
    });
  }

  // Find the discussion message
  const discussionMessage = message.discussion.id(req.params.discussionId);


  if (!discussionMessage) {
    return res.status(404).json({
      success: false,
      error: 'Discussion message not found',
      code: 'NOT_FOUND'
    });
  }

  // Permission check: user can only mark admin messages, admin can only mark user messages
  const isAdminMessage = discussionMessage.from == 'Admin User';

  if (req.user.role === 'admin' && isAdminMessage) {
    return res.status(403).json({
      success: false,
      error: 'Admin can only mark user messages as read',
      code: 'FORBIDDEN'
    });
  }

  if (req.user.role !== 'admin' && !isAdminMessage) {
    return res.status(403).json({
      success: false,
      error: 'User can only mark admin messages as read',
      code: 'FORBIDDEN'
    });
  }

  // Mark discussion message as read
  discussionMessage.status = 'read';

  // If admin is marking a message as read AND contact status is 'newlyReplied'
  // Then change contact status to 'read'
  if (req.user.role === 'admin' && message.status === 'newlyReplied') {
    message.status = 'read';
  }

  await message.save();

  res.status(200).json({
    success: true,
    message: 'Discussion message marked as read',
    data: {
      discussionMessage,
      contactStatus: message.status
    }
  });
});

// @desc    Delete contact message (Admin only)
// @route   DELETE /api/contact/admin/messages/:id
// @access  Private/Admin
const deleteContactMessage = asyncHandler(async (req, res) => {
  const message = await Contact.findById(req.params.id);

  if (!message) {
    const errorResponse = createContactMessageNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  await message.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Contact message deleted successfully',
  });
});

module.exports = {
  submitContactForm,
  getUserContactMessages,
  getContactMessages,
  updateContactMessageStatus,
  addReplyToDiscussion,
  markDiscussionMessageAsRead,
  deleteContactMessage,
};