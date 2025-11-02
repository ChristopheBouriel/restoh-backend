/**
 * Create Initial Admin User Script
 *
 * Creates a default admin user for initial setup.
 * This admin can then promote other users from the admin panel.
 *
 * Usage: node scripts/createAdmin.js
 *
 * Default credentials:
 * Email: admin@restoh.com
 * Password: Admin123!
 *
 * Or pass custom values:
 * EMAIL=admin@example.com PASSWORD=mypassword node scripts/createAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const DEFAULT_ADMIN = {
  name: 'Admin RestOh',
  email: process.env.ADMIN_EMAIL || 'admin@restoh.com',
  password: process.env.ADMIN_PASSWORD || 'Admin123!',
  phone: '0123456789',
  role: 'admin',
  isActive: true
};

const createAdmin = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN.email });

    if (existingAdmin) {
      console.log(`⚠️  Admin user already exists with email: ${DEFAULT_ADMIN.email}`);

      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ User promoted to admin!');
      }

      console.log(`\nAdmin Details:
  - Email: ${existingAdmin.email}
  - Name: ${existingAdmin.name}
  - Role: ${existingAdmin.role}
`);
    } else {
      console.log('⏳ Creating admin user...');
      const admin = await User.create(DEFAULT_ADMIN);

      console.log('✅ Admin user created successfully!\n');
      console.log(`Admin Credentials:
  - Email: ${admin.email}
  - Password: ${DEFAULT_ADMIN.password}
  - Name: ${admin.name}
  - Role: ${admin.role}
`);
      console.log('🎉 You can now login to the admin panel with these credentials.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed.');
  }
};

createAdmin();
