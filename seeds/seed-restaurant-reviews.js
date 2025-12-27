const mongoose = require('mongoose');
require('dotenv').config();
const RestaurantReview = require('../models/RestaurantReview');
const User = require('../models/User');

// Restaurant reviews template
const reviewsTemplate = [
  {
    userEmail: 'jodie@gmail.com',
    ratings: {
      overall: 4,
      service: 5,
      ambiance: 4,
      food: 5,
      value: 4
    },
    comment: 'Excellent food and nice app for ordering, booking... Super!',
    daysAgo: -20
  },
  {
    userEmail: 'demo@test.com',
    ratings: {
      overall: 5,
      service: 5,
      ambiance: 5,
      food: 5,
      value: 4
    },
    comment: 'Food, service, ambiance, everything is really perfect!',
    daysAgo: -15
  },
  {
    userEmail: 'kris@gmail.com',
    ratings: {
      overall: 4,
      service: 4,
      ambiance: 4,
      food: 5,
      value: 4
    },
    comment: 'Really good restaurant. A simple restaurant, but a very good one!',
    daysAgo: -10
  },
  {
    userEmail: 'fab@gmail.com',
    ratings: {
      overall: 5,
      service: 5,
      ambiance: 4,
      food: 5,
      value: 5
    },
    comment: 'Best burger in town! The fries are also amazing. Will definitely come back.',
    daysAgo: -5
  },
  {
    userEmail: 'meow@gmail.com',
    ratings: {
      overall: 4,
      service: 4,
      ambiance: 3,
      food: 5,
      value: 4
    },
    comment: 'Great food, a bit noisy on weekends but overall a nice experience.',
    daysAgo: -2
  },
  {
    userEmail: 'admin@restoh.com',
    ratings: {
      overall: 5,
      service: null,
      ambiance: null,
      food: null,
      value: null
    },
    comment: null, // Rating only, no comment
    daysAgo: 0
  }
];

// Helper to get date relative to today
const getRelativeDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

async function seedRestaurantReviews() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get users for reference
    const users = await User.find({});
    const userMap = {};
    users.forEach(user => {
      userMap[user.email] = {
        id: user._id,
        name: user.name
      };
    });

    // Clear existing restaurant reviews
    await RestaurantReview.deleteMany({});
    console.log('🗑️  Cleared existing restaurant reviews');

    // Create reviews
    const createdReviews = [];
    for (const reviewTemplate of reviewsTemplate) {
      const user = userMap[reviewTemplate.userEmail];
      if (!user) {
        console.warn(`⚠️  User not found: ${reviewTemplate.userEmail}`);
        continue;
      }

      const reviewDate = getRelativeDate(reviewTemplate.daysAgo);

      const reviewData = {
        user: {
          id: user.id,
          name: user.name
        },
        ratings: reviewTemplate.ratings,
        comment: reviewTemplate.comment,
        visitDate: null,
        createdAt: reviewDate,
        updatedAt: reviewDate
      };

      const review = await RestaurantReview.create(reviewData);
      createdReviews.push(review);
    }

    console.log(`✅ Created ${createdReviews.length} restaurant reviews`);

    // Calculate average rating
    const avgRating = createdReviews.reduce((sum, r) => sum + r.ratings.overall, 0) / createdReviews.length;

    // Display created reviews
    console.log('\n📋 CREATED RESTAURANT REVIEWS:');
    createdReviews.forEach((review, index) => {
      const commentPreview = review.comment
        ? `"${review.comment.substring(0, 40)}${review.comment.length > 40 ? '...' : ''}"`
        : '(no comment)';
      console.log(`${index + 1}. ${review.user.name} - ⭐${review.ratings.overall} - ${commentPreview}`);
    });

    console.log(`\n📊 Average rating: ${avgRating.toFixed(1)} / 5`);

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding restaurant reviews:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedRestaurantReviews();
}

module.exports = { seedRestaurantReviews };
