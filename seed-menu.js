const mongoose = require('mongoose');
require('dotenv').config();
const MenuItem = require('./models/MenuItem');

// Sample data with isPopularOverride and isSuggested fields
// Distribution target: 2 appetizers, 3 mains, 1 dessert, 2 beverages
const menuData = [
  // === APPETIZERS (need 3+ for testing, top 2 by orderCount will be popular) ===
  {
    name: 'Salade César',
    description: 'Salade romaine, croûtons croustillants, copeaux de parmesan, sauce césar maison',
    price: 12.50,
    image: 'salade-cesar.jpg',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Salade romaine', 'Croûtons', 'Parmesan', 'Sauce césar'],
    allergens: ['wheat', 'dairy', 'eggs'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 32,
    rating: { average: 4.5, count: 18 },
    reviews: []
  },
  {
    name: 'Frites Maison',
    description: 'Pommes de terre fraîches coupées et frites, servies avec une sauce au choix',
    price: 5.50,
    image: 'frites-maison.jpg',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Pommes de terre', 'Huile végétale', 'Sel'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 28,
    rating: { average: 4.2, count: 12 },
    reviews: []
  },
  {
    name: 'Soupe à l\'Oignon',
    description: 'Soupe française traditionnelle gratinée au fromage',
    price: 8.50,
    image: 'soupe-oignon.jpg',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Oignons', 'Bouillon', 'Pain', 'Gruyère'],
    allergens: ['wheat', 'dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,  // Restaurant suggestion
    orderCount: 15,
    rating: { average: 4.3, count: 8 },
    reviews: []
  },
  {
    name: 'Bruschetta Tomates',
    description: 'Pain grillé, tomates fraîches, basilic, ail et huile d\'olive',
    price: 7.00,
    image: 'bruschetta.jpg',
    category: 'appetizer',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Pain ciabatta', 'Tomates', 'Basilic', 'Ail'],
    allergens: ['wheat'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 12,
    rating: { average: 4.1, count: 6 },
    reviews: []
  },

  // === MAINS (need 4+ for testing, top 3 by orderCount will be popular) ===
  {
    name: 'Burger Gourmand',
    description: 'Pain artisanal, steak de bœuf, fromage, légumes frais, frites maison',
    price: 18.00,
    image: 'burger-gourmand.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Pain burger', 'Steak de bœuf', 'Fromage cheddar', 'Salade', 'Tomates'],
    allergens: ['wheat', 'dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 67,
    rating: { average: 4.7, count: 34 },
    reviews: []
  },
  {
    name: 'Pizza Margherita',
    description: 'Base tomate, mozzarella, basilic frais, huile d\'olive extra vierge',
    price: 15.90,
    image: 'pizza-margherita.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Pâte à pizza', 'Sauce tomate', 'Mozzarella', 'Basilic'],
    allergens: ['wheat', 'dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,  // Restaurant suggestion
    orderCount: 45,
    rating: { average: 4.8, count: 23 },
    reviews: []
  },
  {
    name: 'Steak Frites',
    description: 'Entrecôte grillée servie avec frites maison et sauce au poivre',
    price: 24.00,
    image: 'steak-frites.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Entrecôte', 'Frites', 'Sauce poivre'],
    allergens: ['dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 38,
    rating: { average: 4.6, count: 19 },
    reviews: []
  },
  {
    name: 'Risotto aux Champignons',
    description: 'Riz arborio crémeux aux champignons des bois et parmesan',
    price: 16.50,
    image: 'risotto-champignons.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Riz arborio', 'Champignons', 'Parmesan', 'Bouillon'],
    allergens: ['dairy'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 22,
    rating: { average: 4.4, count: 11 },
    reviews: []
  },
  {
    name: 'Saumon Grillé',
    description: 'Filet de saumon grillé, légumes de saison et sauce citronnée',
    price: 22.00,
    image: 'saumon-grille.jpg',
    category: 'main',
    cuisine: 'continental',
    isVegetarian: false,
    isAvailable: true,
    ingredients: ['Saumon', 'Légumes', 'Citron', 'Herbes'],
    allergens: ['fish'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 18,
    rating: { average: 4.5, count: 9 },
    reviews: []
  },

  // === DESSERTS (need 2+ for testing, top 1 by orderCount will be popular) ===
  {
    name: 'Tiramisu',
    description: 'Dessert italien traditionnel au café et mascarpone, saupoudré de cacao',
    price: 7.50,
    image: 'tiramisu-maison.jpg',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Mascarpone', 'Café', 'Biscuits à la cuillère', 'Cacao'],
    allergens: ['dairy', 'eggs', 'wheat'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 23,
    rating: { average: 4.9, count: 15 },
    reviews: []
  },
  {
    name: 'Crème Brûlée',
    description: 'Crème à la vanille caramélisée au chalumeau',
    price: 6.50,
    image: 'creme-brulee.jpg',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Crème', 'Vanille', 'Sucre', 'Œufs'],
    allergens: ['dairy', 'eggs'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 19,
    rating: { average: 4.7, count: 12 },
    reviews: []
  },
  {
    name: 'Fondant au Chocolat',
    description: 'Gâteau au chocolat noir avec cœur coulant',
    price: 8.00,
    image: 'fondant-chocolat.jpg',
    category: 'dessert',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Chocolat noir', 'Beurre', 'Œufs', 'Farine'],
    allergens: ['dairy', 'eggs', 'wheat'],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: true,  // Restaurant suggestion
    orderCount: 15,
    rating: { average: 4.8, count: 10 },
    reviews: []
  },

  // === BEVERAGES (need 3+ for testing, top 2 by orderCount will be popular) ===
  {
    name: 'Coca-Cola',
    description: 'Boisson gazeuse rafraîchissante 33cl',
    price: 4.00,
    image: 'coca-cola.jpg',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Eau gazéifiée', 'Sucre', 'Arômes naturels'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 42,
    rating: { average: 4.0, count: 8 },
    reviews: []
  },
  {
    name: 'Jus d\'Orange Frais',
    description: 'Jus d\'orange pressé minute',
    price: 5.00,
    image: 'jus-orange.jpg',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Oranges fraîches'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 35,
    rating: { average: 4.6, count: 14 },
    reviews: []
  },
  {
    name: 'Eau Minérale',
    description: 'Eau minérale naturelle 50cl',
    price: 3.00,
    image: 'eau-minerale.jpg',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Eau minérale'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 28,
    rating: { average: 4.0, count: 5 },
    reviews: []
  },
  {
    name: 'Café Expresso',
    description: 'Café italien traditionnel',
    price: 2.50,
    image: 'cafe-expresso.jpg',
    category: 'beverage',
    cuisine: 'continental',
    isVegetarian: true,
    isAvailable: true,
    ingredients: ['Café arabica'],
    allergens: [],
    isPopular: false,
    isPopularOverride: false,
    isSuggested: false,
    orderCount: 55,
    rating: { average: 4.3, count: 20 },
    reviews: []
  }
];

// Function to seed the database
async function seedMenu() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing menu items
    await MenuItem.deleteMany({});
    console.log('🗑️  Cleared existing menu items');

    // Insert new menu items
    const createdItems = await MenuItem.insertMany(menuData);
    console.log(`✅ Created ${createdItems.length} menu items`);

    // Display created items
    console.log('\n📋 CREATED MENU ITEMS:');
    createdItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.category}) - €${item.price} - Rating: ${item.rating.average}`);
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