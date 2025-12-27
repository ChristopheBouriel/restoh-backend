const mongoose = require('mongoose');
require('dotenv').config();
const MenuItem = require('../models/MenuItem');

// Real user IDs from database
const users = {
  jodie: { id: '68f33729a91a5fc87549bcef', name: 'Jodie Falconbridge' },
  demo: { id: '68f33822fcc63e8fd18aa2c3', name: 'Demo User' },
  kris: { id: '691843a8096ec5c775b4fb90', name: 'Kris' },
  meow: { id: '693eb972f74be05db2e7d79a', name: 'Meow' },
  fab: { id: '6944e3cb8d1546420415496f', name: 'Fab' },
  deleted1: { id: '68ff82ed11ff9124166a5a9d', name: 'Deleted User' },
  deleted2: { id: '68ff8d66f28c3944cdd39ecc', name: 'Deleted User' }
};

// Helper to create a review
const createReview = (userKey, rating, comment = null) => ({
  user: {
    id: new mongoose.Types.ObjectId(users[userKey].id),
    name: users[userKey].name
  },
  rating,
  comment,
  createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
});

// Sample data with translations to English
// Distribution target: 2 appetizers, 3 mains, 1 dessert, 2 beverages
const menuData = [
  // === APPETIZERS ===
  {
    name: 'Caesar Salad',
    description: 'Romaine lettuce, crispy croutons, parmesan shavings, homemade caesar dressing',
    price: 12.50,
    image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&q=80',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Romaine lettuce', 'Croutons', 'Parmesan', 'Caesar dressing'],
    allergens: ['wheat', 'dairy', 'eggs'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 8,
    preparationTime: 10,
    reviews: [
      createReview('jodie', 5, 'Fresh and crispy, exactly how I like it!'),
      createReview('kris', 4),
      createReview('meow', 4, 'Good portion size')
    ]
  },
  {
    name: 'Homemade Fries',
    description: 'Fresh cut potatoes, fried to perfection, served with your choice of sauce',
    price: 5.50,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Potatoes', 'Vegetable oil', 'Salt'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 6,
    preparationTime: 15,
    reviews: [
      createReview('demo', 4, 'Crispy on the outside, fluffy inside'),
      createReview('fab', 5)
    ]
  },
  {
    name: 'French Onion Soup',
    description: 'Traditional French soup topped with melted cheese',
    price: 8.50,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Onions', 'Broth', 'Bread', 'Gruyère'],
    allergens: ['wheat', 'dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,
    orderCount: 4,
    preparationTime: 20,
    reviews: [
      createReview('kris', 5, 'Best onion soup I\'ve had in years!'),
      createReview('deleted1', 4)
    ]
  },
  {
    name: 'Tomato Bruschetta',
    description: 'Grilled bread, fresh tomatoes, basil, garlic and olive oil',
    price: 7.00,
    image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=80',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Ciabatta bread', 'Tomatoes', 'Basil', 'Garlic'],
    allergens: ['wheat'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 3,
    preparationTime: 10,
    reviews: [
      createReview('meow', 4)
    ]
  },

  // === MAINS ===
  {
    name: 'Gourmet Burger',
    description: 'Artisan bun, beef steak, cheese, fresh vegetables, homemade fries',
    price: 18.00,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Burger bun', 'Beef steak', 'Cheddar cheese', 'Lettuce', 'Tomatoes'],
    allergens: ['wheat', 'dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 10,
    preparationTime: 20,
    reviews: [
      createReview('fab', 5, 'Juicy patty, perfect cheese melt. Will order again!'),
      createReview('jodie', 5),
      createReview('demo', 4, 'Great burger, generous portions'),
      createReview('kris', 5)
    ]
  },
  {
    name: 'Margherita Pizza',
    description: 'Tomato base, mozzarella, fresh basil, extra virgin olive oil',
    price: 15.90,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Pizza dough', 'Tomato sauce', 'Mozzarella', 'Basil'],
    allergens: ['wheat', 'dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,
    orderCount: 9,
    preparationTime: 18,
    reviews: [
      createReview('meow', 5, 'Authentic Italian taste, thin and crispy crust'),
      createReview('deleted2', 4),
      createReview('jodie', 5)
    ]
  },
  {
    name: 'Steak & Fries',
    description: 'Grilled ribeye served with homemade fries and pepper sauce',
    price: 24.00,
    image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Ribeye', 'Fries', 'Pepper sauce'],
    allergens: ['dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 7,
    preparationTime: 25,
    reviews: [
      createReview('kris', 4, 'Perfectly cooked medium-rare'),
      createReview('fab', 5)
    ]
  },
  {
    name: 'Mushroom Risotto',
    description: 'Creamy arborio rice with wild mushrooms and parmesan',
    price: 16.50,
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&q=80',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Arborio rice', 'Mushrooms', 'Parmesan', 'Broth'],
    allergens: ['dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,
    orderCount: 5,
    preparationTime: 25,
    reviews: [
      createReview('jodie', 4),
      createReview('demo', 5, 'Rich and creamy, mushrooms are fantastic')
    ]
  },
  {
    name: 'Grilled Salmon',
    description: 'Grilled salmon fillet, seasonal vegetables and lemon sauce',
    price: 22.00,
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Salmon', 'Vegetables', 'Lemon', 'Herbs'],
    allergens: ['fish'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 4,
    preparationTime: 20,
    reviews: [
      createReview('meow', 5, 'Fresh fish, nicely seasoned'),
      createReview('deleted1', 4)
    ]
  },

  // === DESSERTS ===
  {
    name: 'Tiramisu',
    description: 'Traditional Italian dessert with coffee and mascarpone, dusted with cocoa',
    price: 7.50,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Mascarpone', 'Coffee', 'Ladyfingers', 'Cocoa'],
    allergens: ['dairy', 'eggs', 'wheat'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 6,
    preparationTime: 0,
    reviews: [
      createReview('fab', 5, 'Heavenly! Perfect coffee flavor'),
      createReview('kris', 5),
      createReview('jodie', 4)
    ]
  },
  {
    name: 'Crème Brûlée',
    description: 'Vanilla cream caramelized with a torch',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1470324161839-ce2bb6fa6bc3?w=800&q=80',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Cream', 'Vanilla', 'Sugar', 'Eggs'],
    allergens: ['dairy', 'eggs'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 4,
    preparationTime: 0,
    reviews: [
      createReview('demo', 5, 'That crack of the caramel top is so satisfying'),
      createReview('meow', 4)
    ]
  },
  {
    name: 'Chocolate Lava Cake',
    description: 'Dark chocolate cake with a molten center',
    price: 8.00,
    image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=80',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Dark chocolate', 'Butter', 'Eggs', 'Flour'],
    allergens: ['dairy', 'eggs', 'wheat'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,
    orderCount: 5,
    preparationTime: 15,
    reviews: [
      createReview('kris', 5, 'The molten center is pure chocolate bliss'),
      createReview('deleted2', 5)
    ]
  },

  // === BEVERAGES ===
  {
    name: 'Coca-Cola',
    description: 'Refreshing carbonated beverage 33cl',
    price: 4.00,
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=800&q=80',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Carbonated water', 'Sugar', 'Natural flavors'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 10,
    preparationTime: 0,
    reviews: []
  },
  {
    name: 'Fresh Orange Juice',
    description: 'Freshly squeezed orange juice',
    price: 5.00,
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=800&q=80',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Fresh oranges'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 7,
    preparationTime: 5,
    reviews: [
      createReview('jodie', 5, 'So fresh, you can taste the difference')
    ]
  },
  {
    name: 'Mineral Water',
    description: 'Natural mineral water 50cl',
    price: 3.00,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Mineral water'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 8,
    preparationTime: 0,
    reviews: []
  },
];

// Calculate rating from reviews
const calculateRating = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return { average: 0, count: 0 };
  }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length
  };
};

// Function to seed the database
async function seedMenu() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing menu items
    await MenuItem.deleteMany({});
    console.log('🗑️  Cleared existing menu items');

    // Calculate ratings from reviews before inserting
    const itemsWithRatings = menuData.map(item => ({
      ...item,
      rating: calculateRating(item.reviews)
    }));

    // Insert new menu items
    const createdItems = await MenuItem.insertMany(itemsWithRatings);
    console.log(`✅ Created ${createdItems.length} menu items`);

    // Display created items
    console.log('\n📋 CREATED MENU ITEMS:');
    createdItems.forEach((item, index) => {
      const reviewInfo = item.reviews.length > 0
        ? `Rating: ${item.rating.average} (${item.rating.count} reviews)`
        : 'No reviews';
      console.log(`${index + 1}. ${item.name} (${item.category}) - €${item.price} - Orders: ${item.orderCount} - ${reviewInfo}`);
    });

    // Close connection
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding menu:', error);
    process.exit(1);
  }
}

// Run the seed function
if (require.main === module) {
  seedMenu();
}

module.exports = { seedMenu, menuData };
