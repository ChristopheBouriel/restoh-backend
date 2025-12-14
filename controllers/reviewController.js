const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const {
  createMenuItemNotFoundError,
  createInvalidRatingError,
  createValidationError,
  createReviewNotFoundError,
  createUnauthorizedReviewUpdateError
} = require('../utils/errorHelpers');

// @desc    Update a review
// @route   PUT /api/review/:reviewId
// @access  Private
const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    const errorResponse = createInvalidRatingError(rating);
    return res.status(400).json(errorResponse);
  }

  // Find the menu item that contains this review
  const menuItem = await MenuItem.findOne({ 'reviews._id': reviewId });

  if (!menuItem) {
    const errorResponse = createReviewNotFoundError(reviewId);
    return res.status(404).json(errorResponse);
  }

  // Find the specific review
  const review = menuItem.reviews.id(reviewId);

  if (!review) {
    const errorResponse = createReviewNotFoundError(reviewId);
    return res.status(404).json(errorResponse);
  }

  // Check if the user owns this review
  if (!review.user.id.equals(req.user._id)) {
    const errorResponse = createUnauthorizedReviewUpdateError();
    return res.status(403).json(errorResponse);
  }

  // Update the review
  if (rating !== undefined) {
    review.rating = rating;
  }
  if (comment !== undefined) {
    review.comment = comment;
  }

  // Save and recalculate average rating
  await menuItem.save();
  await menuItem.calculateAverageRating();

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: review,
  });
});

// @desc    Delete a review
// @route   DELETE /api/review/:reviewId
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  // Find the menu item that contains this review
  const menuItem = await MenuItem.findOne({ 'reviews._id': reviewId });

  if (!menuItem) {
    const errorResponse = createReviewNotFoundError(reviewId);
    return res.status(404).json(errorResponse);
  }

  // Find the specific review
  const review = menuItem.reviews.id(reviewId);

  if (!review) {
    const errorResponse = createReviewNotFoundError(reviewId);
    return res.status(404).json(errorResponse);
  }

  // Check if the user owns this review (or is admin)
  if (!review.user.id.equals(req.user._id) && req.user.role !== 'admin') {
    const errorResponse = createUnauthorizedReviewUpdateError();
    return res.status(403).json(errorResponse);
  }

  // Remove the review using Mongoose subdocument remove method
  review.deleteOne();

  // Save and recalculate average rating
  await menuItem.save();
  await menuItem.calculateAverageRating();

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});

module.exports = {
  updateReview,
  deleteReview,
};
