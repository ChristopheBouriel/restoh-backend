/**
 * E2E Test Data Seeder
 *
 * This script populates the database with test data for Playwright E2E tests.
 * It creates:
 * - Test users (demo user + admin)
 * - Menu items
 * - Tables
 *
 * Usage: node scripts/seed-e2e.js
 * Or via npm: npm run seed:e2e
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Models
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const Contact = require('../models/Contact');
const RestaurantReview = require('../models/RestaurantReview');
const RefreshToken = require('../models/RefreshToken');

// Test users - these match the credentials in e2e/setup/auth.setup.ts
const testUsers = [
  {
    name: 'Demo User',
    email: 'demo@test.com',
    password: '123456',
    phone: '0612345678',
    role: 'user',
    isEmailVerified: true,
    notifications: { newsletter: true, promotions: true }
  },
  {
    name: 'Admin User',
    email: 'admin@restoh.com',
    password: 'admin123',
    phone: '0698765432',
    role: 'admin',
    isEmailVerified: true,
    notifications: { newsletter: true, promotions: true }
  }
];

// Menu items for E2E tests
const menuItems = [
  // Appetizers
  {
    name: 'Caesar Salad',
    description: 'Romaine lettuce, crispy croutons, parmesan shavings, homemade caesar dressing',
    price: 12.50,
    image: 'caesar-salad.jpg',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Romaine lettuce', 'Croutons', 'Parmesan', 'Caesar dressing'],
    allergens: ['wheat', 'dairy', 'eggs'],
    preparationTime: 10,
    orderCount: 5,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  {
    name: 'French Onion Soup',
    description: 'Traditional French soup topped with melted cheese',
    price: 8.50,
    image: 'onion-soup.jpg',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Onions', 'Broth', 'Bread', 'Gruyère'],
    allergens: ['wheat', 'dairy'],
    preparationTime: 15,
    orderCount: 3,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  // Mains
  {
    name: 'Gourmet Burger',
    description: 'Artisan bun, beef steak, cheese, fresh vegetables, homemade fries',
    price: 18.00,
    image: 'burger.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Burger bun', 'Beef steak', 'Cheddar cheese', 'Lettuce', 'Tomatoes'],
    allergens: ['wheat', 'dairy'],
    preparationTime: 20,
    orderCount: 8,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  {
    name: 'Margherita Pizza',
    description: 'Tomato base, mozzarella, fresh basil, extra virgin olive oil',
    price: 15.90,
    image: 'pizza.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Pizza dough', 'Tomato sauce', 'Mozzarella', 'Basil'],
    allergens: ['wheat', 'dairy'],
    preparationTime: 18,
    orderCount: 6,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  {
    name: 'Grilled Salmon',
    description: 'Grilled salmon fillet, seasonal vegetables and lemon sauce',
    price: 22.00,
    image: 'salmon.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Salmon', 'Vegetables', 'Lemon', 'Herbs'],
    allergens: ['fish'],
    preparationTime: 20,
    orderCount: 4,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  // Desserts
  {
    name: 'Tiramisu',
    description: 'Traditional Italian dessert with coffee and mascarpone, dusted with cocoa',
    price: 7.50,
    image: 'tiramisu.jpg',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Mascarpone', 'Coffee', 'Ladyfingers', 'Cocoa'],
    allergens: ['dairy', 'eggs', 'wheat'],
    preparationTime: 0,
    orderCount: 5,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  {
    name: 'Chocolate Lava Cake',
    description: 'Dark chocolate cake with a molten center',
    price: 8.00,
    image: 'lava-cake.jpg',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Dark chocolate', 'Butter', 'Eggs', 'Flour'],
    allergens: ['dairy', 'eggs', 'wheat'],
    preparationTime: 15,
    orderCount: 4,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  // Beverages
  {
    name: 'Fresh Orange Juice',
    description: 'Freshly squeezed orange juice',
    price: 5.00,
    image: 'orange-juice.jpg',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Fresh oranges'],
    allergens: [],
    preparationTime: 5,
    orderCount: 7,
    reviews: [],
    rating: { average: 0, count: 0 }
  },
  {
    name: 'Espresso',
    description: 'Traditional Italian coffee',
    price: 2.50,
    image: 'espresso.jpg',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Arabica coffee'],
    allergens: [],
    preparationTime: 2,
    orderCount: 10,
    reviews: [],
    rating: { average: 0, count: 0 }
  }
];

// Restaurant tables
const tables = [
  { tableNumber: 1, capacity: 2, isActive: true },
  { tableNumber: 2, capacity: 2, isActive: true },
  { tableNumber: 3, capacity: 4, isActive: true },
  { tableNumber: 4, capacity: 4, isActive: true },
  { tableNumber: 5, capacity: 6, isActive: true },
  { tableNumber: 6, capacity: 6, isActive: true },
  { tableNumber: 7, capacity: 8, isActive: true },
  { tableNumber: 8, capacity: 8, isActive: true }
];

async function seedE2E() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ MONGODB_URI not set');
      process.exit(1);
    }

    // Safety check - prevent running on production
    if (mongoUri.includes('mongodb+srv') && !mongoUri.includes('e2e') && !mongoUri.includes('test')) {
      console.error('❌ DANGER: This looks like a production database!');
      console.error('   URI should contain "e2e" or "test" for safety.');
      console.error('   Aborting to prevent data loss.');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear all collections
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      MenuItem.deleteMany({}),
      Table.deleteMany({}),
      Order.deleteMany({}),
      Reservation.deleteMany({}),
      Contact.deleteMany({}),
      RestaurantReview.deleteMany({}),
      RefreshToken.deleteMany({})
    ]);
    console.log('✅ All collections cleared');

    // Create users with hashed passwords
    console.log('👤 Creating test users...');
    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({
        ...userData,
        password: hashedPassword
      });
      console.log(`   ✓ ${userData.email} (${userData.role})`);
    }

    // Create menu items
    console.log('🍽️  Creating menu items...');
    await MenuItem.insertMany(menuItems);
    console.log(`   ✓ ${menuItems.length} menu items created`);

    // Create tables
    console.log('🪑 Creating tables...');
    await Table.insertMany(tables);
    console.log(`   ✓ ${tables.length} tables created`);

    // Summary
    console.log('\n✅ E2E seed completed successfully!');
    console.log('\n📋 Test accounts:');
    console.log('   User:  demo@test.com / 123456');
    console.log('   Admin: admin@restoh.com / admin123');

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding E2E data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedE2E();
}

module.exports = { seedE2E };
