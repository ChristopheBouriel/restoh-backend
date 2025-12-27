const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');

// Demo users with realistic data
const usersData = [
  {
    name: 'Admin User',
    email: 'admin@restoh.com',
    password: 'admin123',
    phone: '0708778878',
    role: 'admin',
    isActive: true,
    isEmailVerified: true,
    address: {
      street: '11, rue de la paix',
      city: 'Annecy',
      zipCode: '74000',
      state: 'France'
    },
    notifications: {
      newsletter: true,
      promotions: false
    },
    totalOrders: 0,
    totalReservations: 0,
    totalSpent: 0
  },
  {
    name: 'Demo User',
    email: 'demo@test.com',
    password: '123456',
    phone: '0655443322',
    role: 'user',
    isActive: true,
    isEmailVerified: true,
    address: {
      street: '12, rue du stade',
      city: 'Annecy',
      state: 'France',
      zipCode: '74000'
    },
    notifications: {
      newsletter: true,
      promotions: true
    },
    totalOrders: 0,
    totalReservations: 0,
    totalSpent: 0
  },
  {
    name: 'Jodie Falconbridge',
    email: 'jodie@gmail.com',
    password: 'password123',
    phone: '0708788700',
    role: 'user',
    isActive: true,
    isEmailVerified: true,
    address: {
      street: '124 Ocean Road',
      city: 'Bunbury',
      zipCode: '06230',
      state: 'Australia'
    },
    notifications: {
      newsletter: true,
      promotions: true
    },
    totalOrders: 0,
    totalReservations: 0,
    totalSpent: 0
  },
  {
    name: 'Kris',
    email: 'kris@gmail.com',
    password: 'password123',
    phone: '0607087788',
    role: 'user',
    isActive: true,
    isEmailVerified: true,
    address: {
      street: '126, rue des frênes',
      city: 'Cruseilles',
      state: 'France',
      zipCode: '74350'
    },
    notifications: {
      newsletter: true,
      promotions: true
    },
    totalOrders: 0,
    totalReservations: 0,
    totalSpent: 0
  },
  {
    name: 'Meow',
    email: 'meow@gmail.com',
    password: 'password123',
    phone: '0708778888',
    role: 'user',
    isActive: true,
    isEmailVerified: false,
    address: {
      street: '1, avenue de Genève',
      city: 'Annecy',
      state: 'France',
      zipCode: '74000'
    },
    notifications: {
      newsletter: true,
      promotions: true
    },
    totalOrders: 0,
    totalReservations: 0,
    totalSpent: 0
  },
  {
    name: 'Fab',
    email: 'fab@gmail.com',
    password: 'password123',
    phone: '0777888877',
    role: 'user',
    isActive: true,
    isEmailVerified: true,
    address: {
      street: '12, rue de l\'île',
      city: 'Annecy',
      state: 'France',
      zipCode: '74000'
    },
    notifications: {
      newsletter: true,
      promotions: true
    },
    totalOrders: 0,
    totalReservations: 0,
    totalSpent: 0
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    // Hash passwords and insert users
    const usersToInsert = await Promise.all(
      usersData.map(async (user) => {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        return {
          ...user,
          password: hashedPassword,
          loginAttempts: 0,
          lockUntil: null,
          passwordChangedAt: null
        };
      })
    );

    const createdUsers = await User.insertMany(usersToInsert);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Display created users
    console.log('\n📋 CREATED USERS:');
    createdUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role} - Verified: ${user.isEmailVerified ? 'Yes' : 'No'}`);
    });

    console.log('\n🔑 Passwords:');
    console.log('   Admin: admin123');
    console.log('   Demo: 123456');
    console.log('   Others: password123');

    // Export user IDs for reference
    const userIds = {};
    createdUsers.forEach(user => {
      const key = user.email.split('@')[0].replace(/[^a-zA-Z]/g, '');
      userIds[key] = user._id.toString();
    });
    console.log('\n📝 User IDs for reference:');
    console.log(JSON.stringify(userIds, null, 2));

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

    return createdUsers;

  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedUsers();
}

module.exports = { seedUsers, usersData };
