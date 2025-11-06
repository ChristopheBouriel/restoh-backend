const Table = require('../models/Table');
const asyncHandler = require('../utils/asyncHandler');
const {
  getTableAvailability,
  findAvailableTables,
  addTableBooking,
  removeTableBooking
} = require('../utils/reservationHelpers');
const {
  createTableNotFoundError,
  createDateRequiredError,
  createDateAndSlotRequiredError,
  createInvalidSlotNumberError
} = require('../utils/errorHelpers');

// @desc    Get all tables
// @route   GET /api/tables
// @access  Private/Admin
const getTables = asyncHandler(async (req, res) => {
  const tables = await Table.find().sort({ tableNumber: 1 });

  res.status(200).json({
    success: true,
    count: tables.length,
    data: tables
  });
});

// @desc    Get table availability for a specific date
// @route   GET /api/tables/availability?date=YYYY-MM-DD
// @access  Private
const getTableAvailabilityForDate = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    const errorResponse = createDateRequiredError();
    return res.status(400).json(errorResponse);
  }

  const availability = await getTableAvailability(date);

  res.status(200).json({
    success: true,
    data: availability,
    date: date
  });
});

// @desc    Find available tables for specific date, slot and capacity
// @route   GET /api/tables/available?date=YYYY-MM-DD&slot=1&capacity=4&excludeReservationId=xxx
// @access  Private
const getAvailableTables = asyncHandler(async (req, res) => {
  const { date, slot, capacity = 1, excludeReservationId } = req.query;

  if (!date || !slot) {
    const errorResponse = createDateAndSlotRequiredError();
    return res.status(400).json(errorResponse);
  }

  const slotNumber = parseInt(slot, 10);
  const requiredCapacity = parseInt(capacity, 10);

  if (slotNumber < 1 || slotNumber > 9) {
    const errorResponse = createInvalidSlotNumberError(slotNumber, 9);
    return res.status(400).json(errorResponse);
  }

  const tables = await findAvailableTables(date, slotNumber, requiredCapacity, excludeReservationId);

  res.status(200).json({
    success: true,
    data: {
      availableTables: tables.availableTables,
      occupiedTables: tables.occupiedTables,
      notEligibleTables: tables.notEligibleTables
    }
  });
});

// @desc    Get single table by ID
// @route   GET /api/tables/:id
// @access  Private/Admin
const getTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    const errorResponse = createTableNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  res.status(200).json({
    success: true,
    data: table
  });
});

// @desc    Update table (capacity, notes, isActive)
// @route   PUT /api/tables/:id
// @access  Private/Admin
const updateTable = asyncHandler(async (req, res) => {
  const { capacity, notes, isActive } = req.body;

  const updateData = {};
  if (capacity !== undefined) updateData.capacity = capacity;
  if (notes !== undefined) updateData.notes = notes;
  if (isActive !== undefined) updateData.isActive = isActive;

  const table = await Table.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!table) {
    const errorResponse = createTableNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  res.status(200).json({
    success: true,
    message: 'Table updated successfully',
    data: table
  });
});

// @desc    Add booking to table
// @route   POST /api/tables/:id/bookings
// @access  Private
const addBookingToTable = asyncHandler(async (req, res) => {
  const { date, slot } = req.body;

  if (!date || !slot) {
    const errorResponse = createDateAndSlotRequiredError();
    return res.status(400).json(errorResponse);
  }

  const slotNumber = parseInt(slot, 10);
  if (slotNumber < 1 || slotNumber > 9) {
    const errorResponse = createInvalidSlotNumberError(slotNumber, 9);
    return res.status(400).json(errorResponse);
  }

  const table = await Table.findById(req.params.id);
  if (!table) {
    const errorResponse = createTableNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  await addTableBooking(table, date, slotNumber);

  res.status(200).json({
    success: true,
    message: 'Booking added to table successfully',
    data: table
  });
});

// @desc    Remove booking from table
// @route   DELETE /api/tables/:id/bookings
// @access  Private
const removeBookingFromTable = asyncHandler(async (req, res) => {
  const { date, slot } = req.body;

  if (!date || !slot) {
    const errorResponse = createDateAndSlotRequiredError();
    return res.status(400).json(errorResponse);
  }

  const slotNumber = parseInt(slot, 10);
  if (slotNumber < 1 || slotNumber > 9) {
    const errorResponse = createInvalidSlotNumberError(slotNumber, 9);
    return res.status(400).json(errorResponse);
  }

  const table = await Table.findById(req.params.id);
  if (!table) {
    const errorResponse = createTableNotFoundError(req.params.id);
    return res.status(404).json(errorResponse);
  }

  await removeTableBooking(table, date, slotNumber);

  res.status(200).json({
    success: true,
    message: 'Booking removed from table successfully',
    data: table
  });
});

// @desc    Initialize tables (Admin only)
// @route   POST /api/tables/initialize
// @access  Private/Admin
const initializeTables = asyncHandler(async (req, res) => {
  await Table.initializeTables();

  res.status(200).json({
    success: true,
    message: 'Tables initialized successfully'
  });
});

module.exports = {
  getTables,
  getTableAvailabilityForDate,
  getAvailableTables,
  getTable,
  updateTable,
  addBookingToTable,
  removeBookingFromTable,
  initializeTables
};