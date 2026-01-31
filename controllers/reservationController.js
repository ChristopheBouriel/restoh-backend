const Reservation = require('../models/Reservation');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { validateReservation } = require('../utils/validation');
const { isValidSlot, isBeforeReservationTime, isAfterReservationTime } = require('../utils/timeSlots');
const {
  validateReservationUpdate,
  canCancelReservation,
  addTableBooking,
  removeTableBooking,
  validateTableCapacity,
  findAvailableTables
} = require('../utils/reservationHelpers');
const Table = require('../models/Table');
const {
  createCapacityExceededError,
  createInvalidTableCapacityError,
  createCapacityInsufficientError,
  createModificationTooLateError,
  createCancellationTooLateError,
  createValidationError,
  createUserNotFoundError
} = require('../utils/errorHelpers');

// @desc    Create new reservation
// @route   POST /api/reservations
// @access  Private
const createReservation = asyncHandler(async (req, res) => {
  // Validate input
  const { error } = validateReservation(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const { date, slot, guests, tableNumber, specialRequest, contactPhone } = req.body;

  // Validate table capacity matches number of guests
  if (tableNumber && tableNumber.length > 0) {
    const capacityValidation = await validateTableCapacity(tableNumber, guests);
    if (!capacityValidation.valid) {
      // Find alternative table suggestions (excluding already selected tables)
      const availability = await findAvailableTables(date, slot, guests);
      const suggestedTables = availability.availableTables
        .filter(tableNum => !tableNumber.includes(tableNum)) // Exclude already selected tables
        .slice(0, 5); // Limit to 5 suggestions

      // Determine which specific error to return
      let errorResponse;

      if (capacityValidation.totalCapacity > guests + 1) {
        // Total capacity exceeds maximum allowed
        errorResponse = createCapacityExceededError(
          guests,
          tableNumber,
          capacityValidation.totalCapacity,
          guests + 1,
          suggestedTables
        );
      } else if (capacityValidation.totalCapacity < guests) {
        // Total capacity is insufficient
        errorResponse = createCapacityInsufficientError(
          guests,
          tableNumber,
          capacityValidation.totalCapacity,
          suggestedTables
        );
      } else {
        // Individual table too large
        errorResponse = createValidationError(
          capacityValidation.message,
          { suggestedTables }
        );
      }

      return res.status(400).json(errorResponse);
    }
  }

  // Create reservation object
  const reservationData = {
    userId: req.user._id,
    userEmail: req.user.email,
    userName: req.user.name,
    date,
    slot,
    guests,
    tableNumber,
    specialRequest,
    contactPhone,
  };

  const reservation = new Reservation(reservationData);

  try {
    await reservation.save();
  } catch (err) {
    // Handle duplicate key error (concurrent booking)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Sorry, someone just booked the same table(s) for this time slot. Please select different tables or try another time.',
        code: 'RESERVATION_CONFLICT',
      });
    }
    throw err; // Re-throw other errors to be handled by errorHandler
  }

  // If tableNumber array is provided, update table bookings
  if (tableNumber && tableNumber.length > 0) {
    try {
      for (const tableNum of tableNumber) {
        const table = await Table.findOne({ tableNumber: parseInt(tableNum) });
        if (table) {
          await addTableBooking(table, date, slot);
          logger.debug('Table booked for reservation', { tableNum, reservationId: reservation._id });
        } else {
          logger.warn('Table not found when creating reservation', { tableNum });
        }
      }
    } catch (error) {
      logger.error('Error updating table bookings', error);
    }
  }

  // Update user statistics
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        totalReservations: 1,
      },
    });
    logger.debug('User statistics updated for new reservation');
  } catch (error) {
    logger.error('Error updating user statistics', error);
  }

  // Populate user details
  const populatedReservation = await Reservation.findById(reservation._id)
    .populate('userId', 'name email phone');

  res.status(201).json({
    success: true,
    message: 'Reservation created successfully',
    data: populatedReservation,
  });
});

// @desc    Get user reservations
// @route   GET /api/reservations
// @access  Private
const getUserReservations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  let query = { userId: req.user._id };

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by upcoming/past reservations
  if (req.query.upcoming === 'true') {
    query.date = { $gte: new Date().setHours(0, 0, 0, 0) };
  } else if (req.query.past === 'true') {
    query.date = { $lt: new Date().setHours(0, 0, 0, 0) };
  }

  const total = await Reservation.countDocuments(query);
  const reservations = await Reservation.find(query)
    .populate('userId', 'name email phone')
    .sort({ date: -1, slot: -1 })
    .limit(limit)
    .skip(startIndex);

  // Pagination result
  const pagination = {};
  if (startIndex + limit < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: reservations.length,
    total,
    pagination,
    data: reservations,
  });
});

// @desc    Get recent reservations (last 15 days) for admin
// @route   GET /api/reservations/admin/recent
// @access  Private/Admin
const getRecentAdminReservations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100); // Max 100
  const status = req.query.status;

  // Calculate date 15 days ago
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  let query = {
    $or: [
      { date: { $gte: fifteenDaysAgo } },
      { createdAt: { $gte: fifteenDaysAgo } }
    ]
  };

  if (status) query.status = status;

  const startIndex = (page - 1) * limit;
  const total = await Reservation.countDocuments(query);
  const reservations = await Reservation.find(query)
    .populate('userId', 'name email phone')
    .sort({ date: -1, slot: -1 })
    .limit(limit)
    .skip(startIndex);

  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  res.status(200).json({
    success: true,
    data: reservations,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore
    }
  });
});

// @desc    Get historical reservations (> 15 days) for admin
// @route   GET /api/reservations/admin/history
// @access  Private/Admin
const getHistoricalAdminReservations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50); // Max 50
  const status = req.query.status;
  const search = req.query.search;
  const { startDate, endDate } = req.query;

  // Validate required date range
  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Both startDate and endDate are required',
      code: 'INVALID_DATE_RANGE'
    });
  }

  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include the entire end date

  // Validate date range (max 1 year)
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  if (end - start > oneYearInMs) {
    return res.status(400).json({
      success: false,
      error: 'Date range cannot exceed 1 year',
      code: 'INVALID_DATE_RANGE'
    });
  }

  let query = {
    date: { $gte: start, $lte: end }
  };

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { reservationNumber: { $regex: search, $options: 'i' } },
      { userName: { $regex: search, $options: 'i' } },
      { userEmail: { $regex: search, $options: 'i' } }
    ];
  }

  const startIndex = (page - 1) * limit;
  const total = await Reservation.countDocuments(query);
  const reservations = await Reservation.find(query)
    .populate('userId', 'name email phone')
    .sort({ date: -1, slot: -1 })
    .limit(limit)
    .skip(startIndex);

  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  res.status(200).json({
    success: true,
    data: reservations,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore
    }
  });
});

// @desc    Update reservation status and assign table (Admin)
// @route   PUT /api/reservations/admin/:id
// @access  Private/Admin
const updateAdminReservation = asyncHandler(async (req, res) => {
  const { status, tableNumber, specialRequests } = req.body;

  const validStatuses = ['confirmed', 'seated', 'completed', 'cancelled', 'no-show'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reservation status',
    });
  }

  // Get the original reservation to handle table changes
  const originalReservation = await Reservation.findById(req.params.id);
  if (!originalReservation) {
    return res.status(404).json({
      success: false,
      message: 'Reservation not found',
    });
  }

  // Handle table number changes
  if (tableNumber && JSON.stringify(tableNumber) !== JSON.stringify(originalReservation.tableNumber)) {
    // Validate new table capacity
    const capacityValidation = await validateTableCapacity(tableNumber, originalReservation.guests);
    if (!capacityValidation.valid) {
      return res.status(400).json({
        success: false,
        message: capacityValidation.message,
      });
    }

    try {
      // Remove booking from old tables if they exist
      if (originalReservation.tableNumber && originalReservation.tableNumber.length > 0) {
        for (const oldTableNum of originalReservation.tableNumber) {
          const oldTable = await Table.findOne({ tableNumber: parseInt(oldTableNum) });
          if (oldTable) {
            await removeTableBooking(oldTable, originalReservation.date, originalReservation.slot);
            logger.debug('Removed booking from table', { tableNum: oldTableNum });
          }
        }
      }

      // Add booking to new tables
      if (tableNumber && tableNumber.length > 0) {
        for (const newTableNum of tableNumber) {
          const newTable = await Table.findOne({ tableNumber: parseInt(newTableNum) });
          if (newTable) {
            await addTableBooking(newTable, originalReservation.date, originalReservation.slot);
            logger.debug('Added booking to table', { tableNum: newTableNum });
          } else {
            return res.status(400).json({
              success: false,
              message: `Table ${newTableNum} not found`,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error updating table bookings', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating table bookings',
      });
    }
  }

  // Handle status changes (especially cancellation)
  if (status === 'cancelled' && originalReservation.status !== 'cancelled' && originalReservation.tableNumber && originalReservation.tableNumber.length > 0) {
    try {
      for (const tableNum of originalReservation.tableNumber) {
        const table = await Table.findOne({ tableNumber: parseInt(tableNum) });
        if (table) {
          await removeTableBooking(table, originalReservation.date, originalReservation.slot);
          logger.debug('Removed booking from table due to cancellation', { tableNum });
        }
      }
    } catch (error) {
      logger.error('Error removing table bookings on cancellation', error);
    }
  }

  const reservation = await Reservation.findByIdAndUpdate(
    req.params.id,
    {
      ...(status && { status }),
      ...(tableNumber && { tableNumber }),
      ...(specialRequests && { specialRequests }),
      updatedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).populate('userId', 'name email phone');

  res.status(200).json({
    success: true,
    message: 'Reservation updated successfully',
    data: reservation,
  });
});

// @desc    Get reservation statistics for admin
// @route   GET /api/reservations/admin/stats
// @access  Private/Admin
const getReservationStats = asyncHandler(async (req, res) => {
  const totalReservations = await Reservation.countDocuments();
  const noShowReservations = await Reservation.countDocuments({ status: 'no-show' });
  const confirmedReservations = await Reservation.countDocuments({ status: 'confirmed' });
  const seatedReservations = await Reservation.countDocuments({ status: 'seated' });
  const completedReservations = await Reservation.countDocuments({ status: 'completed' });
  const cancelledReservations = await Reservation.countDocuments({ status: 'cancelled' });

  res.status(200).json({
    success: true,
    data: {
      totalReservations,
      confirmedReservations,
      seatedReservations,
      completedReservations,
      noShowReservations,
      cancelledReservations,
      reservationsByStatus: {
        confirmed: confirmedReservations,
        seated: seatedReservations,
        completed: completedReservations,
        noShow: noShowReservations,
        cancelled: cancelledReservations,
      },
    },
  });
});

// @desc    Update user's own reservation
// @route   PUT /api/reservations/:id
// @access  Private
const updateUserReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      message: 'Reservation not found',
    });
  }

  if (!reservation.userId.equals(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this reservation',
    });
  }

  // Check if reservation can be updated (only confirmed reservations)
  if (reservation.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: 'Only confirmed reservations can be updated',
    });
  }

  // Validate slot number if provided
  const { date, slot } = req.body;
  if (slot && !isValidSlot(slot)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid slot number',
    });
  }

  // Use helper to validate time constraints
  const validation = validateReservationUpdate(reservation, { date, slot });
  if (!validation.isValid) {
    // Use the new error helper for modification timing errors
    const errorResponse = createModificationTooLateError(validation.hoursUntil || 0);
    return res.status(400).json(errorResponse);
  }

  const { guests, specialRequest, contactPhone, tableNumber } = req.body;

  // Determine which tables to validate (new tables if provided, otherwise existing ones)
  const tablesToValidate = tableNumber || reservation.tableNumber;
  const guestsToValidate = guests || reservation.guests;
  const finalDate = date || reservation.date;
  const finalSlot = slot || reservation.slot;

  // Validate table capacity if guests or tables change
  if (tablesToValidate && tablesToValidate.length > 0) {
    const capacityValidation = await validateTableCapacity(tablesToValidate, guestsToValidate);
    if (!capacityValidation.valid) {
      // Find alternative table suggestions (excluding current reservation and already selected tables)
      const availability = await findAvailableTables(finalDate, finalSlot, guestsToValidate, req.params.id);
      const suggestedTables = availability.availableTables
        .filter(tableNum => !tablesToValidate.includes(tableNum)) // Exclude already selected tables
        .slice(0, 5);

      // Determine which specific error to return
      let errorResponse;

      if (capacityValidation.totalCapacity > guestsToValidate + 1) {
        errorResponse = createCapacityExceededError(
          guestsToValidate,
          tablesToValidate,
          capacityValidation.totalCapacity,
          guestsToValidate + 1,
          suggestedTables
        );
      } else if (capacityValidation.totalCapacity < guestsToValidate) {
        errorResponse = createCapacityInsufficientError(
          guestsToValidate,
          tablesToValidate,
          capacityValidation.totalCapacity,
          suggestedTables
        );
      } else {
        errorResponse = createValidationError(
          capacityValidation.message,
          { suggestedTables }
        );
      }

      return res.status(400).json(errorResponse);
    }
  }

  // Determine final table number for booking updates
  const finalTableNumber = tableNumber || reservation.tableNumber;

  // Check if we need to update table bookings
  const dateChanged = date && date !== reservation.date;
  const slotChanged = slot && slot !== reservation.slot;
  const tablesChanged = tableNumber && JSON.stringify(tableNumber.sort()) !== JSON.stringify(reservation.tableNumber.sort());

  if (dateChanged || slotChanged || tablesChanged) {
    try {
      // Remove old bookings
      if (reservation.tableNumber && reservation.tableNumber.length > 0) {
        for (const tableNum of reservation.tableNumber) {
          const table = await Table.findOne({ tableNumber: parseInt(tableNum) });
          if (table) {
            await removeTableBooking(table, reservation.date, reservation.slot);
            logger.debug('Removed old booking for table', { tableNum });
          }
        }
      }

      // Add new bookings with final date/slot/tables
      if (finalTableNumber && finalTableNumber.length > 0) {
        for (const tableNum of finalTableNumber) {
          const table = await Table.findOne({ tableNumber: parseInt(tableNum) });
          if (table) {
            await addTableBooking(table, finalDate, finalSlot);
            logger.debug('Added new booking for table', { tableNum, date: finalDate, slot: finalSlot });
          } else {
            return res.status(400).json({
              success: false,
              message: `Table ${tableNum} not found`,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error updating table bookings', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating table bookings',
      });
    }
  }

  // Validate input if provided
  const updateData = {};
  if (date) updateData.date = date;
  if (slot) updateData.slot = slot;
  if (guests) updateData.guests = guests;
  if (tableNumber) updateData.tableNumber = tableNumber;
  if (specialRequest !== undefined) updateData.specialRequest = specialRequest;
  if (contactPhone) updateData.contactPhone = contactPhone;
  updateData.updatedAt = new Date();

  const updatedReservation = await Reservation.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('userId', 'name email phone');

  res.status(200).json({
    success: true,
    message: 'Reservation updated successfully',
    data: updatedReservation,
  });
});

// @desc    Update reservation status only (Admin)
// @route   PATCH /api/reservations/admin/:id/status
// @access  Private/Admin
const updateReservationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required',
    });
  }

  const validStatuses = ['confirmed', 'seated', 'completed', 'cancelled', 'no-show'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
    });
  }

  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      message: 'Reservation not found',
    });
  }

  // Validate status change based on reservation time
  const beforeReservation = isBeforeReservationTime(reservation.date, reservation.slot);
  const afterReservation = isAfterReservationTime(reservation.date, reservation.slot);

  // Status-specific time validations
  if (status === 'seated' && beforeReservation) {
    return res.status(400).json({
      success: false,
      message: 'Cannot mark reservation as seated before the reservation time',
    });
  }

  if ((status === 'completed' || status === 'no-show') && beforeReservation) {
    return res.status(400).json({
      success: false,
      message: `Cannot mark reservation as ${status} before the reservation time`,
    });
  }

  // Handle table booking removal for statuses that free up tables
  const statusesThatFreeTable = ['cancelled', 'completed', 'no-show'];
  const shouldFreeTable = statusesThatFreeTable.includes(status) &&
                          !statusesThatFreeTable.includes(reservation.status) &&
                          reservation.tableNumber &&
                          reservation.tableNumber.length > 0;

  if (shouldFreeTable) {
    try {
      for (const tableNum of reservation.tableNumber) {
        const table = await Table.findOne({ tableNumber: parseInt(tableNum) });
        if (table) {
          await removeTableBooking(table, reservation.date, reservation.slot);
          logger.debug('Removed booking from table', { tableNum, status });
        }
      }
    } catch (error) {
      logger.error('Error removing table bookings', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating table bookings',
      });
    }
  }

  reservation.status = status;
  reservation.updatedAt = new Date();
  await reservation.save();

  const updatedReservation = await Reservation.findById(reservation._id)
    .populate('userId', 'name email phone');

  res.status(200).json({
    success: true,
    message: `Reservation status updated to ${status}`,
    data: updatedReservation,
  });
});

// @desc    Cancel user's own reservation
// @route   DELETE /api/reservations/:id
// @access  Private
const cancelUserReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      message: 'Reservation not found',
    });
  }

  if (!reservation.userId.equals(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this reservation',
    });
  }

  // Check if reservation can be cancelled
  if (reservation.status === 'cancelled' || reservation.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Reservation is already cancelled or completed',
    });
  }

  if (reservation.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: 'Only confirmed reservations can be cancelled',
    });
  }

  // Use helper to validate cancellation time constraints
  const cancellationCheck = canCancelReservation(reservation.date, reservation.slot);
  if (!cancellationCheck.canCancel) {
    const errorResponse = createCancellationTooLateError(cancellationCheck.hoursUntil);
    return res.status(400).json(errorResponse);
  }

  reservation.status = 'cancelled';
  reservation.updatedAt = new Date();
  await reservation.save();

  // If tableNumber array is assigned, remove table bookings
  if (reservation.tableNumber && reservation.tableNumber.length > 0) {
    try {
      for (const tableNum of reservation.tableNumber) {
        const table = await Table.findOne({ tableNumber: parseInt(tableNum) });
        if (table) {
          await removeTableBooking(table, reservation.date, reservation.slot);
          logger.debug('Table booking removed for cancelled reservation', { tableNum, reservationId: reservation._id });
        } else {
          logger.warn('Table not found when cancelling reservation', { tableNum });
        }
      }
    } catch (error) {
      logger.error('Error removing table bookings', error);
    }
  }

  // Update user statistics (decrement totalReservations)
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        totalReservations: -1,
      },
    });
    logger.debug('User statistics updated for cancelled reservation');
  } catch (error) {
    logger.error('Error updating user statistics', error);
  }

  res.status(200).json({
    success: true,
    message: 'Reservation cancelled successfully',
    data: reservation,
  });
});

// @desc    Get reservations for a specific user (Admin)
// @route   GET /api/admin/users/:userId/reservations
// @access  Private/Admin
const getAdminUserReservations = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    const errorResponse = createUserNotFoundError(userId);
    return res.status(404).json(errorResponse);
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;

  let query = { userId };

  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by upcoming/past reservations
  if (req.query.upcoming === 'true') {
    query.date = { $gte: new Date().setHours(0, 0, 0, 0) };
  } else if (req.query.past === 'true') {
    query.date = { $lt: new Date().setHours(0, 0, 0, 0) };
  }

  const total = await Reservation.countDocuments(query);
  const reservations = await Reservation.find(query)
    .populate('userId', 'name email phone')
    .sort({ date: -1, slot: -1 })
    .limit(limit)
    .skip(startIndex);

  // Pagination info
  const pagination = {};
  if (startIndex + limit < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: reservations.length,
    total,
    pagination,
    data: reservations,
  });
});

module.exports = {
  createReservation,
  getUserReservations,
  getRecentAdminReservations,
  getHistoricalAdminReservations,
  updateAdminReservation,
  updateReservationStatus,
  updateUserReservation,
  cancelUserReservation,
  getReservationStats,
  getAdminUserReservations,
};