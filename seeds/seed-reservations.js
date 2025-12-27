const mongoose = require('mongoose');
require('dotenv').config();
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Table = require('../models/Table');

// Helper to get date relative to today
const getRelativeDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Time slots reference:
// 1: 11:00, 2: 11:30, 3: 12:00, 4: 12:30, 5: 13:00, 6: 13:30, 7: 14:00
// 8: 18:30, 9: 19:00, 10: 19:30, 11: 20:00, 12: 20:30, 13: 21:00, 14: 21:30

// Reservations will be created with dynamic user IDs
const reservationsTemplate = [
  // Past reservations (completed)
  {
    userEmail: 'admin@restoh.com',
    date: getRelativeDate(-10),
    slot: 12,
    guests: 3,
    status: 'completed',
    tableNumber: [13],
    contactPhone: '0708778878'
  },
  {
    userEmail: 'demo@test.com',
    date: getRelativeDate(-7),
    slot: 11,
    guests: 4,
    status: 'completed',
    tableNumber: [21],
    contactPhone: '0655443322'
  },
  {
    userEmail: 'jodie@gmail.com',
    date: getRelativeDate(-5),
    slot: 10,
    guests: 2,
    status: 'completed',
    tableNumber: [2],
    contactPhone: '0708788700'
  },
  {
    userEmail: 'kris@gmail.com',
    date: getRelativeDate(-3),
    slot: 7,
    guests: 3,
    status: 'completed',
    tableNumber: [1, 4],
    contactPhone: '0607087788'
  },
  // Past reservation (cancelled)
  {
    userEmail: 'jodie@gmail.com',
    date: getRelativeDate(-2),
    slot: 8,
    guests: 4,
    status: 'cancelled',
    tableNumber: [1, 4],
    contactPhone: '0708788700'
  },
  // Past reservation (no-show)
  {
    userEmail: 'meow@gmail.com',
    date: getRelativeDate(-1),
    slot: 11,
    guests: 5,
    status: 'no-show',
    tableNumber: [10, 11, 12],
    contactPhone: '0708778888'
  },
  // Today's reservations
  {
    userEmail: 'admin@restoh.com',
    date: getRelativeDate(0),
    slot: 4,
    guests: 2,
    status: 'confirmed',
    tableNumber: [8],
    contactPhone: '0708778878'
  },
  {
    userEmail: 'demo@test.com',
    date: getRelativeDate(0),
    slot: 11,
    guests: 3,
    status: 'confirmed',
    tableNumber: [7],
    contactPhone: '0655443322'
  },
  // Future reservations
  {
    userEmail: 'jodie@gmail.com',
    date: getRelativeDate(1),
    slot: 11,
    guests: 2,
    status: 'confirmed',
    tableNumber: [10],
    contactPhone: '0708788700'
  },
  {
    userEmail: 'fab@gmail.com',
    date: getRelativeDate(2),
    slot: 4,
    guests: 2,
    status: 'confirmed',
    tableNumber: [5],
    contactPhone: '0777888877'
  },
  {
    userEmail: 'demo@test.com',
    date: getRelativeDate(3),
    slot: 13,
    guests: 4,
    status: 'confirmed',
    tableNumber: [5, 8],
    specialRequest: 'Birthday party',
    contactPhone: '0655443322'
  },
  {
    userEmail: 'kris@gmail.com',
    date: getRelativeDate(5),
    slot: 11,
    guests: 4,
    status: 'confirmed',
    tableNumber: [15],
    contactPhone: '0607087788'
  },
  {
    userEmail: 'admin@restoh.com',
    date: getRelativeDate(7),
    slot: 5,
    guests: 3,
    status: 'confirmed',
    tableNumber: [6, 9],
    contactPhone: '0708778878'
  }
];

async function seedReservations() {
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

    // Clear existing reservations
    await Reservation.deleteMany({});
    console.log('🗑️  Cleared existing reservations');

    // Reset all table bookings
    await Table.updateMany({}, { $set: { tableBookings: [] } });
    console.log('🗑️  Cleared table bookings');

    // Create reservations with proper user references
    const reservationsToInsert = reservationsTemplate.map(res => {
      const user = userMap[res.userEmail];
      if (!user) {
        console.warn(`⚠️  User not found: ${res.userEmail}`);
        return null;
      }
      return {
        userId: user.id,
        userEmail: res.userEmail,
        userName: user.name,
        date: res.date,
        slot: res.slot,
        guests: res.guests,
        status: res.status,
        tableNumber: res.tableNumber,
        specialRequest: res.specialRequest || null,
        contactPhone: res.contactPhone,
        notes: null
      };
    }).filter(Boolean);

    // Insert reservations one by one to trigger pre-save hooks
    const createdReservations = [];
    for (const resData of reservationsToInsert) {
      const reservation = new Reservation(resData);
      await reservation.save();
      createdReservations.push(reservation);

      // Update table bookings for non-cancelled/no-show reservations
      if (!['cancelled', 'no-show', 'completed'].includes(resData.status)) {
        for (const tableNum of resData.tableNumber) {
          await Table.findOneAndUpdate(
            { tableNumber: tableNum },
            {
              $push: {
                tableBookings: {
                  date: resData.date,
                  bookedSlots: [resData.slot, resData.slot + 1, resData.slot + 2]
                }
              }
            }
          );
        }
      }
    }

    console.log(`✅ Created ${createdReservations.length} reservations`);

    // Update user statistics
    for (const email of Object.keys(userMap)) {
      const count = createdReservations.filter(r => r.userEmail === email).length;
      if (count > 0) {
        await User.findOneAndUpdate(
          { email },
          { $set: { totalReservations: count } }
        );
      }
    }
    console.log('✅ Updated user reservation counts');

    // Display created reservations
    console.log('\n📋 CREATED RESERVATIONS:');
    createdReservations.forEach((res, index) => {
      const dateStr = res.date.toISOString().split('T')[0];
      console.log(`${index + 1}. ${res.reservationNumber} - ${res.userName} - ${dateStr} - ${res.guests} guests - ${res.status}`);
    });

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding reservations:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedReservations();
}

module.exports = { seedReservations };
