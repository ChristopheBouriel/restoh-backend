const mongoose = require('mongoose');
require('dotenv').config();

// Import all seed functions
const { seedTables } = require('./seed-tables');
const { seedUsers } = require('./seed-users');
const { seedMenu } = require('./seed-menu');
const { seedReservations } = require('./seed-reservations');
const { seedOrders } = require('./seed-orders');
const { seedContacts } = require('./seed-contacts');
const { seedRestaurantReviews } = require('./seed-restaurant-reviews');

// Models for cleanup
const Table = require('../models/Table');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Reservation = require('../models/Reservation');
const Order = require('../models/Order');
const Contact = require('../models/Contact');
const RestaurantReview = require('../models/RestaurantReview');
const RefreshToken = require('../models/RefreshToken');
const EmailVerification = require('../models/EmailVerification');
const PasswordReset = require('../models/PasswordReset');

async function clearAllCollections() {
  console.log('\n🧹 Clearing all collections...');

  await Table.deleteMany({});
  await User.deleteMany({});
  await MenuItem.deleteMany({});
  await Reservation.deleteMany({});
  await Order.deleteMany({});
  await Contact.deleteMany({});
  await RestaurantReview.deleteMany({});
  await RefreshToken.deleteMany({});
  await EmailVerification.deleteMany({});
  await PasswordReset.deleteMany({});

  console.log('✅ All collections cleared\n');
}

async function seedAll() {
  console.log('🌱 Starting full database seed...\n');
  console.log('═'.repeat(50));

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`   Database: ${mongoose.connection.db.databaseName}\n`);

    // Clear everything first
    await clearAllCollections();

    // Seed in order (dependencies matter)
    console.log('═'.repeat(50));
    console.log('📦 STEP 1: Seeding tables...');
    console.log('═'.repeat(50));
    await seedTablesInternal();

    console.log('\n' + '═'.repeat(50));
    console.log('👥 STEP 2: Seeding users...');
    console.log('═'.repeat(50));
    await seedUsersInternal();

    console.log('\n' + '═'.repeat(50));
    console.log('🍽️  STEP 3: Seeding menu items...');
    console.log('═'.repeat(50));
    await seedMenuInternal();

    console.log('\n' + '═'.repeat(50));
    console.log('📅 STEP 4: Seeding reservations...');
    console.log('═'.repeat(50));
    await seedReservationsInternal();

    console.log('\n' + '═'.repeat(50));
    console.log('🛒 STEP 5: Seeding orders...');
    console.log('═'.repeat(50));
    await seedOrdersInternal();

    console.log('\n' + '═'.repeat(50));
    console.log('📧 STEP 6: Seeding contacts...');
    console.log('═'.repeat(50));
    await seedContactsInternal();

    console.log('\n' + '═'.repeat(50));
    console.log('⭐ STEP 7: Seeding restaurant reviews...');
    console.log('═'.repeat(50));
    await seedRestaurantReviewsInternal();

    // Final summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 FINAL SUMMARY');
    console.log('═'.repeat(50));

    const counts = {
      tables: await Table.countDocuments(),
      users: await User.countDocuments(),
      menuItems: await MenuItem.countDocuments(),
      reservations: await Reservation.countDocuments(),
      orders: await Order.countDocuments(),
      contacts: await Contact.countDocuments(),
      restaurantReviews: await RestaurantReview.countDocuments()
    };

    console.log(`   Tables:             ${counts.tables}`);
    console.log(`   Users:              ${counts.users}`);
    console.log(`   Menu Items:         ${counts.menuItems}`);
    console.log(`   Reservations:       ${counts.reservations}`);
    console.log(`   Orders:             ${counts.orders}`);
    console.log(`   Contacts:           ${counts.contacts}`);
    console.log(`   Restaurant Reviews: ${counts.restaurantReviews}`);

    console.log('\n🔑 Login credentials:');
    console.log('   Admin:  admin@restoh.com / admin123');
    console.log('   Demo:   demo@test.com / 123456');
    console.log('   Users:  jodie@gmail.com, kris@gmail.com, fab@gmail.com, meow@gmail.com');
    console.log('   Other passwords: password123');

    await mongoose.connection.close();
    console.log('\n✅ Database seeding complete!');
    console.log('🔒 Database connection closed\n');

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Internal versions that don't manage their own connection
async function seedTablesInternal() {
  const Table = require('../models/Table');
  const { tablesData } = require('./seed-tables');

  const tablesToInsert = tablesData.map(table => ({
    ...table,
    tableBookings: []
  }));

  const created = await Table.insertMany(tablesToInsert);
  console.log(`✅ Created ${created.length} tables`);
}

async function seedUsersInternal() {
  const bcrypt = require('bcryptjs');
  const User = require('../models/User');
  const { usersData } = require('./seed-users');

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

  const created = await User.insertMany(usersToInsert);
  console.log(`✅ Created ${created.length} users`);
}

async function seedMenuInternal() {
  const { menuData } = require('./seed-menu');
  const MenuItem = require('../models/MenuItem');

  // Calculate ratings
  const calculateRating = (reviews) => {
    if (!reviews || reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return {
      average: Math.round((sum / reviews.length) * 10) / 10,
      count: reviews.length
    };
  };

  const itemsWithRatings = menuData.map(item => ({
    ...item,
    rating: calculateRating(item.reviews)
  }));

  const created = await MenuItem.insertMany(itemsWithRatings);
  console.log(`✅ Created ${created.length} menu items`);
}

async function seedReservationsInternal() {
  const Reservation = require('../models/Reservation');
  const User = require('../models/User');
  const Table = require('../models/Table');
  const { getLabelFromSlot } = require('../utils/timeSlots');

  const users = await User.find({});
  const userMap = {};
  users.forEach(user => {
    userMap[user.email] = { id: user._id, name: user.name };
  });

  const getRelativeDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Helper to generate reservation number
  const generateReservationNumber = (date, slot, tableNumbers) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const timeLabel = getLabelFromSlot(slot);
    const timeStr = timeLabel.replace(':', '');
    const tablesStr = tableNumbers.sort((a, b) => a - b).join('-');
    return `${dateStr}-${timeStr}-${tablesStr}`;
  };

  const reservationsTemplate = [
    { userEmail: 'admin@restoh.com', date: getRelativeDate(-10), slot: 12, guests: 3, status: 'completed', tableNumber: [13], contactPhone: '0708778878' },
    { userEmail: 'demo@test.com', date: getRelativeDate(-7), slot: 11, guests: 4, status: 'completed', tableNumber: [21], contactPhone: '0655443322' },
    { userEmail: 'jodie@gmail.com', date: getRelativeDate(-5), slot: 10, guests: 2, status: 'completed', tableNumber: [2], contactPhone: '0708788700' },
    { userEmail: 'kris@gmail.com', date: getRelativeDate(-3), slot: 7, guests: 3, status: 'completed', tableNumber: [1, 4], contactPhone: '0607087788' },
    { userEmail: 'jodie@gmail.com', date: getRelativeDate(-2), slot: 8, guests: 4, status: 'cancelled', tableNumber: [1, 4], contactPhone: '0708788700' },
    { userEmail: 'meow@gmail.com', date: getRelativeDate(-1), slot: 11, guests: 5, status: 'no-show', tableNumber: [10, 11, 12], contactPhone: '0708778888' },
    { userEmail: 'admin@restoh.com', date: getRelativeDate(0), slot: 4, guests: 2, status: 'confirmed', tableNumber: [8], contactPhone: '0708778878' },
    { userEmail: 'demo@test.com', date: getRelativeDate(0), slot: 11, guests: 3, status: 'confirmed', tableNumber: [7], contactPhone: '0655443322' },
    { userEmail: 'jodie@gmail.com', date: getRelativeDate(1), slot: 11, guests: 2, status: 'confirmed', tableNumber: [10], contactPhone: '0708788700' },
    { userEmail: 'fab@gmail.com', date: getRelativeDate(2), slot: 4, guests: 2, status: 'confirmed', tableNumber: [5], contactPhone: '0777888877' },
    { userEmail: 'demo@test.com', date: getRelativeDate(3), slot: 13, guests: 4, status: 'confirmed', tableNumber: [5, 8], specialRequest: 'Birthday party', contactPhone: '0655443322' },
    { userEmail: 'kris@gmail.com', date: getRelativeDate(5), slot: 11, guests: 4, status: 'confirmed', tableNumber: [15], contactPhone: '0607087788' },
    { userEmail: 'admin@restoh.com', date: getRelativeDate(7), slot: 5, guests: 3, status: 'confirmed', tableNumber: [6, 9], contactPhone: '0708778878' }
  ];

  // Build reservations with generated reservation numbers
  const reservationsToInsert = [];
  for (const res of reservationsTemplate) {
    const user = userMap[res.userEmail];
    if (!user) continue;

    reservationsToInsert.push({
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
      notes: null,
      reservationNumber: generateReservationNumber(res.date, res.slot, res.tableNumber)
    });
  }

  // Use collection.insertMany to bypass mongoose validation for past dates
  const result = await Reservation.collection.insertMany(reservationsToInsert);
  const created = { length: result.insertedCount };

  // Update table bookings for active reservations
  for (const res of reservationsTemplate) {
    if (!['cancelled', 'no-show', 'completed'].includes(res.status)) {
      for (const tableNum of res.tableNumber) {
        await Table.findOneAndUpdate(
          { tableNumber: tableNum },
          { $push: { tableBookings: { date: res.date, bookedSlots: [res.slot, res.slot + 1, res.slot + 2] } } }
        );
      }
    }
  }

  // Update user stats
  for (const email of Object.keys(userMap)) {
    const resCount = await Reservation.countDocuments({ userEmail: email });
    if (resCount > 0) {
      await User.findOneAndUpdate({ email }, { $set: { totalReservations: resCount } });
    }
  }

  console.log(`✅ Created ${created.length} reservations`);
}

async function seedOrdersInternal() {
  const Order = require('../models/Order');
  const User = require('../models/User');
  const MenuItem = require('../models/MenuItem');

  const users = await User.find({});
  const menuItems = await MenuItem.find({});

  const userMap = {};
  users.forEach(user => {
    userMap[user.email] = { id: user._id, name: user.name, phone: user.phone };
  });

  const menuMap = {};
  menuItems.forEach(item => {
    menuMap[item.name] = { id: item._id, name: item.name, price: item.price, image: item.image };
  });

  const getRelativeDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  const ordersTemplate = [
    { userEmail: 'jodie@gmail.com', daysAgo: -15, orderType: 'pickup', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'card', items: [{ name: 'Gourmet Burger', quantity: 1 }, { name: 'Coca-Cola', quantity: 1 }, { name: 'Homemade Fries', quantity: 1 }] },
    { userEmail: 'demo@test.com', daysAgo: -12, orderType: 'delivery', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'card', deliveryAddress: { street: '12, rue du stade', city: 'Annecy', zipCode: '74000' }, items: [{ name: 'Margherita Pizza', quantity: 2 }] },
    { userEmail: 'admin@restoh.com', daysAgo: -10, orderType: 'delivery', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'card', deliveryAddress: { street: '11, rue de la paix', city: 'Annecy', zipCode: '74000' }, items: [{ name: 'Gourmet Burger', quantity: 1 }, { name: 'Homemade Fries', quantity: 1 }] },
    { userEmail: 'kris@gmail.com', daysAgo: -8, orderType: 'delivery', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'card', deliveryAddress: { street: '126, rue des frênes', city: 'Cruseilles', zipCode: '74350' }, items: [{ name: 'Gourmet Burger', quantity: 1 }] },
    { userEmail: 'jodie@gmail.com', daysAgo: -5, orderType: 'pickup', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'card', items: [{ name: 'Margherita Pizza', quantity: 1 }] },
    { userEmail: 'admin@restoh.com', daysAgo: -3, orderType: 'delivery', status: 'cancelled', paymentStatus: 'paid', paymentMethod: 'card', deliveryAddress: { street: '11, rue de la paix', city: 'Annecy', zipCode: '74000' }, items: [{ name: 'Gourmet Burger', quantity: 1 }, { name: 'Coca-Cola', quantity: 1 }] },
    { userEmail: 'demo@test.com', daysAgo: -2, orderType: 'pickup', status: 'pending', paymentStatus: 'paid', paymentMethod: 'card', items: [{ name: 'Tiramisu', quantity: 2 }, { name: 'Crème Brûlée', quantity: 1 }] },
    { userEmail: 'kris@gmail.com', daysAgo: -1, orderType: 'delivery', status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'card', deliveryAddress: { street: '126, rue des frênes', city: 'Cruseilles', zipCode: '74350' }, items: [{ name: 'Grilled Salmon', quantity: 1 }, { name: 'Mineral Water', quantity: 2 }] },
    { userEmail: 'jodie@gmail.com', daysAgo: 0, orderType: 'pickup', status: 'preparing', paymentStatus: 'paid', paymentMethod: 'card', items: [{ name: 'Caesar Salad', quantity: 1 }, { name: 'Steak & Fries', quantity: 1 }] },
    { userEmail: 'demo@test.com', daysAgo: 0, orderType: 'delivery', status: 'pending', paymentStatus: 'pending', paymentMethod: 'cash', deliveryAddress: { street: '12, rue du stade', city: 'Annecy', zipCode: '74000' }, items: [{ name: 'Mushroom Risotto', quantity: 1 }, { name: 'Fresh Orange Juice', quantity: 1 }] },
    { userEmail: 'fab@gmail.com', daysAgo: 0, orderType: 'pickup', status: 'ready', paymentStatus: 'paid', paymentMethod: 'card', items: [{ name: 'Gourmet Burger', quantity: 2 }, { name: 'Homemade Fries', quantity: 2 }, { name: 'Coca-Cola', quantity: 2 }] },
    { userEmail: 'admin@restoh.com', daysAgo: 0, orderType: 'delivery', status: 'pending', paymentStatus: 'pending', paymentMethod: 'cash', deliveryAddress: { street: '11, rue de la paix', city: 'Annecy', zipCode: '74000' }, items: [{ name: 'Chocolate Lava Cake', quantity: 2 }, { name: 'Tiramisu', quantity: 1 }] }
  ];

  let orderNumber = 1;
  const userOrderStats = {};

  for (const orderTemplate of ordersTemplate) {
    const user = userMap[orderTemplate.userEmail];
    if (!user) continue;

    const items = [];
    let totalPrice = 0;
    for (const itemTemplate of orderTemplate.items) {
      const menuItem = menuMap[itemTemplate.name];
      if (!menuItem) continue;
      items.push({
        menuItem: menuItem.id,
        name: menuItem.name,
        quantity: itemTemplate.quantity,
        price: menuItem.price,
        image: menuItem.image
      });
      totalPrice += menuItem.price * itemTemplate.quantity;
    }

    await Order.create({
      userId: user.id,
      userEmail: orderTemplate.userEmail,
      userName: user.name,
      phone: user.phone,
      items,
      totalPrice: Math.round(totalPrice * 100) / 100,
      orderType: orderTemplate.orderType,
      status: orderTemplate.status,
      paymentStatus: orderTemplate.paymentStatus,
      paymentMethod: orderTemplate.paymentMethod,
      deliveryAddress: orderTemplate.deliveryAddress || null,
      orderNumber: `ORD-${String(orderNumber++).padStart(6, '0')}`,
      createdAt: getRelativeDate(orderTemplate.daysAgo),
      updatedAt: getRelativeDate(orderTemplate.daysAgo)
    });

    if (!userOrderStats[orderTemplate.userEmail]) {
      userOrderStats[orderTemplate.userEmail] = { count: 0, total: 0 };
    }
    userOrderStats[orderTemplate.userEmail].count++;
    if (orderTemplate.status !== 'cancelled') {
      userOrderStats[orderTemplate.userEmail].total += totalPrice;
    }
  }

  // Update user stats
  for (const [email, stats] of Object.entries(userOrderStats)) {
    await User.findOneAndUpdate(
      { email },
      { $set: { totalOrders: stats.count, totalSpent: Math.round(stats.total * 100) / 100 } }
    );
  }

  console.log(`✅ Created ${orderNumber - 1} orders`);
}

async function seedContactsInternal() {
  const Contact = require('../models/Contact');
  const User = require('../models/User');

  const users = await User.find({});
  const userMap = {};
  users.forEach(user => {
    userMap[user.email] = { id: user._id, name: user.name };
  });

  const getRelativeDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  const contactsTemplate = [
    { userEmail: 'demo@test.com', name: 'Demo User', phone: '0655443322', subject: 'Complaint - Booking fail', message: 'I cannot book!?', status: 'replied', daysAgo: -15, discussion: [{ adminEmail: 'admin@restoh.com', text: "We'll immediately check our system", hoursAfter: 1 }] },
    { userEmail: 'kris@gmail.com', name: 'Kris', phone: '0607087788', subject: 'General inquiry - Test', message: 'This is a test message.', status: 'read', daysAgo: -10 },
    { userEmail: 'demo@test.com', name: 'Demo User', phone: '0655443322', subject: 'Complaint - Slow app', message: 'The app is very slow', status: 'new', daysAgo: -5 },
    { name: 'Bob', email: 'bob@gmail.com', subject: 'Reservation - Booking', message: 'I would like to book for tomorrow', status: 'replied', daysAgo: -8, discussion: [{ adminEmail: 'admin@restoh.com', text: 'Please call us to confirm', hoursAfter: 2 }] },
    { name: 'Joe', email: 'joe@gmail.com', subject: 'Compliment - Great experience', message: 'Amazing dinner last night!', status: 'read', daysAgo: -3 },
    { name: 'Guy', email: 'guy@gmail.com', subject: 'General inquiry - Vegan options', message: 'Do you have vegan options?', status: 'new', daysAgo: -1 },
    { userEmail: 'demo@test.com', name: 'Demo User', phone: '0655443322', subject: 'General inquiry - Group reservation', message: 'Question about 20 people reservation', status: 'replied', daysAgo: 0, discussion: [{ adminEmail: 'admin@restoh.com', text: 'We can accommodate groups up to 22 people', hoursAfter: 1 }] },
    { name: 'Marie', email: 'marie@gmail.com', subject: 'Job application - Server position', message: 'Where can I send my CV?', status: 'new', daysAgo: 0 }
  ];

  let count = 0;
  for (const ct of contactsTemplate) {
    const user = ct.userEmail ? userMap[ct.userEmail] : null;
    const baseDate = getRelativeDate(ct.daysAgo);

    const discussion = [];
    if (ct.discussion) {
      for (const msg of ct.discussion) {
        const msgDate = new Date(baseDate);
        msgDate.setHours(msgDate.getHours() + msg.hoursAfter);
        const msgAdmin = userMap[msg.adminEmail];
        discussion.push({
          userId: msgAdmin.id,
          name: msgAdmin.name,
          role: 'admin',
          text: msg.text,
          date: msgDate,
          status: 'read'
        });
      }
    }

    await Contact.create({
      userId: user ? user.id : null,
      name: ct.name,
      email: ct.userEmail || ct.email,
      phone: ct.phone || null,
      subject: ct.subject,
      message: ct.message,
      status: ct.status,
      discussion,
      isDeleted: false,
      createdAt: baseDate,
      updatedAt: baseDate
    });
    count++;
  }

  console.log(`✅ Created ${count} contacts`);
}

async function seedRestaurantReviewsInternal() {
  const RestaurantReview = require('../models/RestaurantReview');
  const User = require('../models/User');

  const users = await User.find({});
  const userMap = {};
  users.forEach(user => {
    userMap[user.email] = { id: user._id, name: user.name };
  });

  const getRelativeDate = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  const reviewsTemplate = [
    { userEmail: 'jodie@gmail.com', ratings: { overall: 4, service: 5, ambiance: 4, food: 5, value: 4 }, comment: 'Excellent food and nice app!', daysAgo: -20 },
    { userEmail: 'demo@test.com', ratings: { overall: 5, service: 5, ambiance: 5, food: 5, value: 4 }, comment: 'Everything is perfect!', daysAgo: -15 },
    { userEmail: 'kris@gmail.com', ratings: { overall: 4, service: 4, ambiance: 4, food: 5, value: 4 }, comment: 'Really good restaurant!', daysAgo: -10 },
    { userEmail: 'fab@gmail.com', ratings: { overall: 5, service: 5, ambiance: 4, food: 5, value: 5 }, comment: 'Best burger in town!', daysAgo: -5 },
    { userEmail: 'meow@gmail.com', ratings: { overall: 4, service: 4, ambiance: 3, food: 5, value: 4 }, comment: 'Great food, a bit noisy.', daysAgo: -2 },
    { userEmail: 'admin@restoh.com', ratings: { overall: 5 }, comment: null, daysAgo: 0 }
  ];

  let count = 0;
  for (const rt of reviewsTemplate) {
    const user = userMap[rt.userEmail];
    if (!user) continue;

    const reviewDate = getRelativeDate(rt.daysAgo);
    await RestaurantReview.create({
      user: { id: user.id, name: user.name },
      ratings: rt.ratings,
      comment: rt.comment,
      createdAt: reviewDate,
      updatedAt: reviewDate
    });
    count++;
  }

  console.log(`✅ Created ${count} restaurant reviews`);
}

if (require.main === module) {
  seedAll();
}

module.exports = { seedAll };
