const RestaurantReview = require('../models/RestaurantReview');
const asyncHandler = require('../utils/asyncHandler');
const {
  createReviewNotFoundError,
  createUnauthorizedReviewUpdateError,
  createReviewAlreadyExistsError,
  createValidationError
} = require('../utils/errorHelpers');

// @desc    Add review for restaurant
// @route   POST /api/restaurant/review
// @access  Private
const addRestaurantReview = asyncHandler(async (req, res) => {
  const { ratings, comment, visitDate } = req.body;

  // Check if overall rating is provided
  if (!ratings || !ratings.overall || ratings.overall < 1 || ratings.overall > 5) {
    const errorResponse = createValidationError('Overall rating is required and must be between 1 and 5', {
      field: 'ratings.overall',
      message: 'Overall rating is required and must be between 1 and 5'
    });
    return res.status(400).json(errorResponse);
  }

  // Check if user already reviewed the restaurant
  const existingReview = await RestaurantReview.findOne({
    'user.id': req.user._id
  });

  if (existingReview) {
    const errorResponse = createReviewAlreadyExistsError('restaurant');
    return res.status(400).json(errorResponse);
  }

  const newReview = await RestaurantReview.create({
    user: {
      id: req.user._id,
      name: req.user.name
    },
    ratings: {
      overall: ratings.overall,
      service: ratings.service || null,
      ambiance: ratings.ambiance || null,
      food: ratings.food || null,
      value: ratings.value || null
    },
    comment,
    visitDate: visitDate || null
  });

  res.status(201).json({
    success: true,
    message: 'Restaurant review added successfully',
    data: newReview
  });
});

// @desc    Get all restaurant reviews
// @route   GET /api/restaurant/reviews
// @access  Public
const getRestaurantReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  const total = await RestaurantReview.countDocuments();
  const reviews = await RestaurantReview.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  const pagination = {};
  if (startIndex + limit < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    pagination,
    data: reviews
  });
});

// @desc    Get restaurant rating statistics
// @route   GET /api/restaurant/rating
// @access  Public
const getRestaurantRating = asyncHandler(async (req, res) => {
  const statistics = await RestaurantReview.getStatistics();

  res.status(200).json({
    success: true,
    data: statistics
  });
});

// @desc    Update a restaurant review
// @route   PUT /api/restaurant/review/:id
// @access  Private
const updateRestaurantReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ratings, comment, visitDate } = req.body;

  const review = await RestaurantReview.findById(id);

  if (!review) {
    const errorResponse = createReviewNotFoundError(id);
    return res.status(404).json(errorResponse);
  }

  // Check if user owns this review
  if (review.user.id.toString() !== req.user._id.toString()) {
    const errorResponse = createUnauthorizedReviewUpdateError();
    return res.status(403).json(errorResponse);
  }

  // Update ratings
  if (ratings) {
    if (ratings.overall !== undefined) {
      if (ratings.overall < 1 || ratings.overall > 5) {
        const errorResponse = createValidationError('Overall rating must be between 1 and 5', {
          field: 'ratings.overall'
        });
        return res.status(400).json(errorResponse);
      }
      review.ratings.overall = ratings.overall;
    }
    if (ratings.service !== undefined) review.ratings.service = ratings.service;
    if (ratings.ambiance !== undefined) review.ratings.ambiance = ratings.ambiance;
    if (ratings.food !== undefined) review.ratings.food = ratings.food;
    if (ratings.value !== undefined) review.ratings.value = ratings.value;
  }

  // Update comment
  if (comment !== undefined) {
    review.comment = comment;
  }

  // Update visit date
  if (visitDate !== undefined) {
    review.visitDate = visitDate;
  }

  await review.save();

  res.status(200).json({
    success: true,
    message: 'Restaurant review updated successfully',
    data: review
  });
});

// @desc    Delete a restaurant review
// @route   DELETE /api/restaurant/review/:id
// @access  Private
const deleteRestaurantReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await RestaurantReview.findById(id);

  if (!review) {
    const errorResponse = createReviewNotFoundError(id);
    return res.status(404).json(errorResponse);
  }

  // Check if user owns this review (or is admin)
  if (review.user.id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    const errorResponse = createUnauthorizedReviewUpdateError();
    return res.status(403).json(errorResponse);
  }

  await RestaurantReview.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Restaurant review deleted successfully'
  });
});

module.exports = {
  addRestaurantReview,
  getRestaurantReviews,
  getRestaurantRating,
  updateRestaurantReview,
  deleteRestaurantReview
};
