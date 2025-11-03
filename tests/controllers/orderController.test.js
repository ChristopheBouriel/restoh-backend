const Order = require('../../models/Order');
const User = require('../../models/User');
const {
  cancelOrder,
} = require('../../controllers/orderController');

const {
  createTestUser,
  createTestOrder,
  mockRequest,
  mockResponse,
  mockNext,
} = require('../helpers/testHelpers');

describe('Order Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  describe('cancelOrder', () => {
    it('should allow cancellation for pending order with pending payment', async () => {
      const user = await createTestUser();
      const order = await createTestOrder({
        userId: user._id,
        status: 'pending',
        paymentStatus: 'pending'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order cancelled successfully',
        data: expect.objectContaining({ status: 'cancelled' }),
      });
    });

    it('should allow cancellation for confirmed order with pending payment', async () => {
      const user = await createTestUser();
      const order = await createTestOrder({
        userId: user._id,
        status: 'confirmed',
        paymentStatus: 'pending'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order cancelled successfully',
        data: expect.objectContaining({ status: 'cancelled' }),
      });
    });

    it('should prevent cancellation for paid orders', async () => {
      const user = await createTestUser();
      const order = await createTestOrder({
        userId: user._id,
        status: 'pending',
        paymentStatus: 'paid'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: expect.any(String),
          details: expect.any(Object),
        })
      );
    });

    it('should prevent cancellation for orders in preparing status', async () => {
      const user = await createTestUser();
      const order = await createTestOrder({
        userId: user._id,
        status: 'preparing',
        paymentStatus: 'pending'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: expect.any(String),
          details: expect.any(Object),
        })
      );
    });

    it('should prevent cancellation for already delivered orders', async () => {
      const user = await createTestUser();
      const order = await createTestOrder({
        userId: user._id,
        status: 'delivered',
        paymentStatus: 'paid'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: expect.any(String),
          details: expect.any(Object),
        })
      );
    });

    it('should prevent cancellation for already cancelled orders', async () => {
      const user = await createTestUser();
      const order = await createTestOrder({
        userId: user._id,
        status: 'cancelled',
        paymentStatus: 'pending'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: expect.any(String),
          details: expect.any(Object),
        })
      );
    });

    it('should return 404 if order not found', async () => {
      const user = await createTestUser();
      req.params = { id: '507f1f77bcf86cd799439011' };
      req.user = { _id: user._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
          code: 'ORDER_NOT_FOUND',
          details: expect.any(Object),
        })
      );
    });

    it('should return 403 if user does not own the order', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser({ email: 'user2@example.com' });
      const order = await createTestOrder({
        userId: user1._id,
        status: 'pending',
        paymentStatus: 'pending'
      });

      req.params = { id: order._id.toString() };
      req.user = { _id: user2._id };

      await cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authorized to cancel this order',
      });
    });
  });
});