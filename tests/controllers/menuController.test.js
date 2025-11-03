const MenuItem = require('../../models/MenuItem');
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  addReview,
  getPopularItems,
} = require('../../controllers/menuController');

const {
  createTestUser,
  createTestAdmin,
  createTestMenuItem,
  mockRequest,
  mockResponse,
  mockNext,
} = require('../helpers/testHelpers');

jest.mock('../../middleware/cloudinaryUpload', () => ({
  deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
}));

describe('Menu Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  describe('getMenuItems', () => {
    it('should return all menu items with default pagination', async () => {
      const menuItem1 = await createTestMenuItem({ name: 'Item 1', price: 10 });
      const menuItem2 = await createTestMenuItem({ name: 'Item 2', price: 20 });

      await getMenuItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        total: 2,
        pagination: {},
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Item 1' }),
          expect.objectContaining({ name: 'Item 2' }),
        ]),
      });
    });

    it('should filter menu items by category', async () => {
      await createTestMenuItem({ name: 'Main Dish', category: 'main', cuisine: 'asian' });
      await createTestMenuItem({ name: 'Appetizer', category: 'appetizer', cuisine: 'lao' });

      req.query = { category: 'main' };

      await getMenuItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        total: 1,
        pagination: {},
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Main Dish', category: 'main' }),
        ]),
      });
    });

    it('should filter menu items by vegetarian status', async () => {
      await createTestMenuItem({ name: 'Meat Dish', isVegetarian: false });
      await createTestMenuItem({ name: 'Veggie Dish', isVegetarian: true });

      req.query = { vegetarian: 'true' };

      await getMenuItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        total: 1,
        pagination: {},
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Veggie Dish', isVegetarian: true }),
        ]),
      });
    });

    it('should search menu items by name', async () => {
      await createTestMenuItem({ name: 'Chicken Curry' });
      await createTestMenuItem({ name: 'Beef Steak' });

      req.query = { search: 'chicken' };

      await getMenuItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        total: 1,
        pagination: {},
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Chicken Curry' }),
        ]),
      });
    });

    it('should handle pagination correctly', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestMenuItem({ name: `Item ${i}` });
      }

      req.query = { page: '2', limit: '2' };

      await getMenuItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        total: 5,
        pagination: {
          prev: { page: 1, limit: 2 },
          next: { page: 3, limit: 2 },
        },
        data: expect.any(Array),
      });
    });
  });

  describe('getMenuItem', () => {
    it('should return a single menu item by ID', async () => {
      const menuItem = await createTestMenuItem({ name: 'Test Item' });

      req.params = { id: menuItem._id.toString() };

      await getMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ name: 'Test Item' }),
      });
    });

    it('should return 404 if menu item not found', async () => {
      req.params = { id: '507f1f77bcf86cd799439011' };

      await getMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'MENU_ITEM_NOT_FOUND',
          details: expect.objectContaining({
            menuItemId: '507f1f77bcf86cd799439011',
          }),
        })
      );
    });
  });

  describe('createMenuItem', () => {
    it('should create a new menu item successfully', async () => {
      const admin = await createTestAdmin();
      req.user = { _id: admin._id, role: 'admin' };
      req.body = {
        name: 'New Dish',
        description: 'A delicious new dish',
        price: 25.99,
        category: 'main',
        cuisine: 'asian',
        isAvailable: true,
      };

      await createMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Menu item created successfully',
        data: expect.objectContaining({
          name: 'New Dish',
          price: 25.99,
        }),
      });
    });

    it('should return 400 for validation errors', async () => {
      const admin = await createTestAdmin();
      req.user = { _id: admin._id, role: 'admin' };
      req.body = {
        name: '',
        description: 'A dish without name',
        price: -5,
      };

      await createMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Validation error'),
          code: 'VALIDATION_ERROR',
          details: expect.any(Object),
        })
      );
    });

    it('should handle image upload correctly', async () => {
      const admin = await createTestAdmin();
      req.user = { _id: admin._id, role: 'admin' };
      req.body = {
        name: 'Dish with Image',
        description: 'A dish with uploaded image',
        price: 15.99,
        category: 'main',
        cuisine: 'lao',
        image: 'https://cloudinary.com/image.jpg',
      };

      await createMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Menu item created successfully',
        data: expect.objectContaining({
          image: 'https://cloudinary.com/image.jpg',
        }),
      });
    });
  });

  describe('updateMenuItem', () => {
    it('should update a menu item successfully', async () => {
      const admin = await createTestAdmin();
      const menuItem = await createTestMenuItem({ name: 'Original Name' });

      req.user = { _id: admin._id, role: 'admin' };
      req.params = { id: menuItem._id.toString() };
      req.body = { name: 'Updated Name', price: 30 };

      await updateMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Menu item updated successfully',
        data: expect.objectContaining({
          name: 'Updated Name',
          price: 30,
        }),
      });
    });

    it('should return 404 if menu item not found', async () => {
      const admin = await createTestAdmin();
      req.user = { _id: admin._id, role: 'admin' };
      req.params = { id: '507f1f77bcf86cd799439011' };
      req.body = { name: 'Updated Name' };

      await updateMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'MENU_ITEM_NOT_FOUND',
          details: expect.any(Object),
        })
      );
    });

    it('should handle validation errors', async () => {
      const admin = await createTestAdmin();
      const menuItem = await createTestMenuItem();

      req.user = { _id: admin._id, role: 'admin' };
      req.params = { id: menuItem._id.toString() };
      req.body = { price: -10 };

      await updateMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'VALIDATION_ERROR',
          details: expect.any(Object),
        })
      );
    });
  });

  describe('deleteMenuItem', () => {
    it('should delete a menu item successfully', async () => {
      const admin = await createTestAdmin();
      const menuItem = await createTestMenuItem();

      req.user = { _id: admin._id, role: 'admin' };
      req.params = { id: menuItem._id.toString() };

      await deleteMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Menu item deleted successfully',
      });

      const deletedItem = await MenuItem.findById(menuItem._id);
      expect(deletedItem).toBeNull();
    });

    it('should return 404 if menu item not found', async () => {
      const admin = await createTestAdmin();
      req.user = { _id: admin._id, role: 'admin' };
      req.params = { id: '507f1f77bcf86cd799439011' };

      await deleteMenuItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'MENU_ITEM_NOT_FOUND',
          details: expect.any(Object),
        })
      );
    });
  });

  describe('addReview', () => {
    it('should add a review to a menu item successfully', async () => {
      const user = await createTestUser();
      const menuItem = await createTestMenuItem();

      req.user = { _id: user._id, name: user.name };
      req.params = { id: menuItem._id.toString() };
      req.body = { rating: 5, comment: 'Excellent dish!' };

      await addReview(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Review added successfully',
        data: expect.objectContaining({
          rating: expect.objectContaining({
            average: 5,
            count: 1,
          }),
        }),
      });
    });

    it('should prevent duplicate reviews from same user', async () => {
      const user = await createTestUser();
      const menuItem = await createTestMenuItem({
        reviews: [{ user: user._id, rating: 4, comment: 'Good' }],
      });

      req.user = { _id: user._id, name: user.name };
      req.params = { id: menuItem._id.toString() };
      req.body = { rating: 5, comment: 'Updated review' };

      await addReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'REVIEW_ALREADY_EXISTS',
          details: expect.any(Object),
        })
      );
    });

    it('should validate rating range', async () => {
      const user = await createTestUser();
      const menuItem = await createTestMenuItem();

      req.user = { _id: user._id, name: user.name };
      req.params = { id: menuItem._id.toString() };
      req.body = { rating: 6, comment: 'Invalid rating' };

      await addReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Rating must be between 1 and 5',
          code: 'INVALID_RATING',
          details: expect.objectContaining({
            field: 'rating',
            providedValue: 6,
            validRange: { min: 1, max: 5 },
          }),
        })
      );
    });

    it('should return 404 if menu item not found', async () => {
      const user = await createTestUser();
      req.user = { _id: user._id, name: user.name };
      req.params = { id: '507f1f77bcf86cd799439011' };
      req.body = { rating: 5, comment: 'Great!' };

      await addReview(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'MENU_ITEM_NOT_FOUND',
          details: expect.any(Object),
        })
      );
    });
  });

  describe('getPopularItems', () => {
    it('should return popular items sorted by order count', async () => {
      await createTestMenuItem({ name: 'Popular Item', orderCount: 50 });
      await createTestMenuItem({ name: 'Less Popular', orderCount: 10 });
      await createTestMenuItem({ name: 'Most Popular', orderCount: 100 });

      req.query = { limit: '2' };

      await getPopularItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: [
          expect.objectContaining({ name: 'Most Popular', orderCount: 100 }),
          expect.objectContaining({ name: 'Popular Item', orderCount: 50 }),
        ],
      });
    });

    it('should use default limit of 6 items', async () => {
      for (let i = 1; i <= 10; i++) {
        await createTestMenuItem({ name: `Item ${i}`, orderCount: i });
      }

      await getPopularItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 6,
        data: expect.any(Array),
      });
    });
  });
});