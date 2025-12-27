const mongoose = require('mongoose');
require('dotenv').config();
const Table = require('../models/Table');

// Tables configuration based on production data
// 22 tables: 12x2-seat, 8x4-seat, 2x6-seat
const tablesData = [
  // 2-seat tables (1-12)
  { tableNumber: 1, capacity: 2, isActive: true },
  { tableNumber: 2, capacity: 2, isActive: true },
  { tableNumber: 3, capacity: 2, isActive: true },
  { tableNumber: 4, capacity: 2, isActive: true },
  { tableNumber: 5, capacity: 2, isActive: true },
  { tableNumber: 6, capacity: 2, isActive: true },
  { tableNumber: 7, capacity: 2, isActive: true },
  { tableNumber: 8, capacity: 2, isActive: true },
  { tableNumber: 9, capacity: 2, isActive: true },
  { tableNumber: 10, capacity: 2, isActive: true },
  { tableNumber: 11, capacity: 2, isActive: true },
  { tableNumber: 12, capacity: 2, isActive: true },
  // 4-seat tables (13-20)
  { tableNumber: 13, capacity: 4, isActive: true },
  { tableNumber: 14, capacity: 4, isActive: true },
  { tableNumber: 15, capacity: 4, isActive: true },
  { tableNumber: 16, capacity: 4, isActive: true },
  { tableNumber: 17, capacity: 4, isActive: true },
  { tableNumber: 18, capacity: 4, isActive: true },
  { tableNumber: 19, capacity: 4, isActive: true },
  { tableNumber: 20, capacity: 4, isActive: true },
  // 6-seat tables (21-22)
  { tableNumber: 21, capacity: 6, isActive: true },
  { tableNumber: 22, capacity: 6, isActive: true },
];

async function seedTables() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing tables
    await Table.deleteMany({});
    console.log('🗑️  Cleared existing tables');

    // Insert tables with empty bookings
    const tablesToInsert = tablesData.map(table => ({
      ...table,
      tableBookings: []
    }));

    const createdTables = await Table.insertMany(tablesToInsert);
    console.log(`✅ Created ${createdTables.length} tables`);

    // Display summary
    console.log('\n📋 TABLES SUMMARY:');
    console.log(`   - 2-seat tables: 12 (Tables 1-12)`);
    console.log(`   - 4-seat tables: 8 (Tables 13-20)`);
    console.log(`   - 6-seat tables: 2 (Tables 21-22)`);
    console.log(`   - Total capacity: ${12*2 + 8*4 + 2*6} seats`);

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding tables:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedTables();
}

module.exports = { seedTables, tablesData };
