const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');

// Helper to get date relative to today
const getRelativeDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

// Orders template - will be populated with actual menu item IDs
const ordersTemplate = [
  // Past orders (delivered)
  {
    userEmail: 'jodie@gmail.com',
    daysAgo: -15,
    orderType: 'pickup',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    items: [
      { name: 'Gourmet Burger', quantity: 1 },
      { name: 'Coca-Cola', quantity: 1 },
      { name: 'Homemade Fries', quantity: 1 }
    ]
  },
  {
    userEmail: 'demo@test.com',
    daysAgo: -12,
    orderType: 'delivery',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    deliveryAddress: {
      street: '12, rue du stade',
      city: 'Annecy',
      zipCode: '74000',
      instructions: 'Interphone n°2'
    },
    items: [
      { name: 'Margherita Pizza', quantity: 2 }
    ]
  },
  {
    userEmail: 'admin@restoh.com',
    daysAgo: -10,
    orderType: 'delivery',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    deliveryAddress: {
      street: '11, rue de la paix',
      city: 'Annecy',
      zipCode: '74000',
      instructions: '2nd floor'
    },
    items: [
      { name: 'Gourmet Burger', quantity: 1 },
      { name: 'Homemade Fries', quantity: 1 }
    ]
  },
  {
    userEmail: 'kris@gmail.com',
    daysAgo: -8,
    orderType: 'delivery',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    deliveryAddress: {
      street: '126, rue des frênes',
      city: 'Cruseilles',
      zipCode: '74350',
      instructions: null
    },
    items: [
      { name: 'Gourmet Burger', quantity: 1 }
    ]
  },
  {
    userEmail: 'jodie@gmail.com',
    daysAgo: -5,
    orderType: 'pickup',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    items: [
      { name: 'Margherita Pizza', quantity: 1 }
    ]
  },
  // Cancelled order
  {
    userEmail: 'admin@restoh.com',
    daysAgo: -3,
    orderType: 'delivery',
    status: 'cancelled',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    deliveryAddress: {
      street: '11, rue de la paix',
      city: 'Annecy',
      zipCode: '74000',
      instructions: null
    },
    items: [
      { name: 'Gourmet Burger', quantity: 1 },
      { name: 'Coca-Cola', quantity: 1 },
      { name: 'Homemade Fries', quantity: 1 }
    ]
  },
  // Recent orders with various statuses
  {
    userEmail: 'demo@test.com',
    daysAgo: -2,
    orderType: 'pickup',
    status: 'pending',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    items: [
      { name: 'Tiramisu', quantity: 2 },
      { name: 'Crème Brûlée', quantity: 1 }
    ]
  },
  {
    userEmail: 'kris@gmail.com',
    daysAgo: -1,
    orderType: 'delivery',
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    deliveryAddress: {
      street: '126, rue des frênes',
      city: 'Cruseilles',
      zipCode: '74350',
      instructions: null
    },
    items: [
      { name: 'Grilled Salmon', quantity: 1 },
      { name: 'Mineral Water', quantity: 2 }
    ]
  },
  // Today's orders
  {
    userEmail: 'jodie@gmail.com',
    daysAgo: 0,
    orderType: 'pickup',
    status: 'preparing',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    items: [
      { name: 'Caesar Salad', quantity: 1 },
      { name: 'Steak & Fries', quantity: 1 }
    ]
  },
  {
    userEmail: 'demo@test.com',
    daysAgo: 0,
    orderType: 'delivery',
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    deliveryAddress: {
      street: '12, rue du stade',
      city: 'Annecy',
      zipCode: '74000',
      instructions: null
    },
    specialInstructions: 'Ring twice',
    items: [
      { name: 'Mushroom Risotto', quantity: 1 },
      { name: 'Fresh Orange Juice', quantity: 1 }
    ]
  },
  {
    userEmail: 'fab@gmail.com',
    daysAgo: 0,
    orderType: 'pickup',
    status: 'ready',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    items: [
      { name: 'Gourmet Burger', quantity: 2 },
      { name: 'Homemade Fries', quantity: 2 },
      { name: 'Coca-Cola', quantity: 2 }
    ]
  },
  {
    userEmail: 'admin@restoh.com',
    daysAgo: 0,
    orderType: 'delivery',
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    deliveryAddress: {
      street: '11, rue de la paix',
      city: 'Annecy',
      zipCode: '74000',
      instructions: '3rd floor'
    },
    items: [
      { name: 'Chocolate Lava Cake', quantity: 2 },
      { name: 'Tiramisu', quantity: 1 }
    ]
  }
];

async function seedOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get users and menu items
    const users = await User.find({});
    const menuItems = await MenuItem.find({});

    const userMap = {};
    users.forEach(user => {
      userMap[user.email] = {
        id: user._id,
        name: user.name,
        phone: user.phone
      };
    });

    const menuMap = {};
    menuItems.forEach(item => {
      menuMap[item.name] = {
        id: item._id,
        name: item.name,
        price: item.price,
        image: item.image
      };
    });

    // Clear existing orders
    await Order.deleteMany({});
    console.log('🗑️  Cleared existing orders');

    // Reset order counter
    let orderNumber = 1;

    // Create orders
    const createdOrders = [];
    for (const orderTemplate of ordersTemplate) {
      const user = userMap[orderTemplate.userEmail];
      if (!user) {
        console.warn(`⚠️  User not found: ${orderTemplate.userEmail}`);
        continue;
      }

      // Build items array with actual menu item data
      const items = [];
      let totalPrice = 0;
      for (const itemTemplate of orderTemplate.items) {
        const menuItem = menuMap[itemTemplate.name];
        if (!menuItem) {
          console.warn(`⚠️  Menu item not found: ${itemTemplate.name}`);
          continue;
        }
        items.push({
          menuItem: menuItem.id,
          name: menuItem.name,
          quantity: itemTemplate.quantity,
          price: menuItem.price,
          image: menuItem.image,
          specialInstructions: null
        });
        totalPrice += menuItem.price * itemTemplate.quantity;
      }

      const orderData = {
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
        specialInstructions: orderTemplate.specialInstructions || null,
        orderNumber: `ORD-${String(orderNumber++).padStart(6, '0')}`,
        createdAt: getRelativeDate(orderTemplate.daysAgo),
        updatedAt: getRelativeDate(orderTemplate.daysAgo)
      };

      const order = await Order.create(orderData);
      createdOrders.push(order);
    }

    console.log(`✅ Created ${createdOrders.length} orders`);

    // Update user order statistics
    const userOrderStats = {};
    createdOrders.forEach(order => {
      if (!userOrderStats[order.userEmail]) {
        userOrderStats[order.userEmail] = { count: 0, total: 0 };
      }
      userOrderStats[order.userEmail].count++;
      if (order.status !== 'cancelled') {
        userOrderStats[order.userEmail].total += order.totalPrice;
      }
    });

    for (const [email, stats] of Object.entries(userOrderStats)) {
      await User.findOneAndUpdate(
        { email },
        {
          $set: {
            totalOrders: stats.count,
            totalSpent: Math.round(stats.total * 100) / 100
          }
        }
      );
    }
    console.log('✅ Updated user order statistics');

    // Display created orders
    console.log('\n📋 CREATED ORDERS:');
    createdOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.orderNumber} - ${order.userName} - €${order.totalPrice} - ${order.orderType} - ${order.status}`);
    });

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding orders:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedOrders();
}

module.exports = { seedOrders };
