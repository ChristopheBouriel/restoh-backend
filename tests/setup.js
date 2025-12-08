const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Set environment variables for tests
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRE = '30d';
process.env.NODE_ENV = 'test';

let mongoServer;

beforeAll(async () => {
  // Disconnect any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Register all models after connection (required for populate() to work)
  require('../models/User');
  require('../models/MenuItem');
  require('../models/Order');
  require('../models/Reservation');
  require('../models/RestaurantReview');
  require('../models/Table');
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});