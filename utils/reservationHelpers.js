const { getTimeFromSlot } = require('./timeSlots');
const Table = require('../models/Table');
const Reservation = require('../models/Reservation');

/**
 * Create a Date object from reservation date and slot number
 * @param {Date|string} date - Reservation date
 * @param {number} slotNumber - Slot number
 * @returns {Date|null} Complete datetime or null if invalid slot
 */
const createReservationDateTime = (date, slotNumber) => {
  const timeComponents = getTimeFromSlot(slotNumber);
  if (!timeComponents) return null;

  const reservationDate = new Date(date);
  reservationDate.setHours(timeComponents.hours, timeComponents.minutes, 0, 0);

  return reservationDate;
};

/**
 * Calculate hours between two dates
 * @param {Date} laterDate - Later date
 * @param {Date} earlierDate - Earlier date
 * @returns {number} Hours difference (can be negative if laterDate is before earlierDate)
 */
const getHoursDifference = (laterDate, earlierDate) => {
  return (laterDate.getTime() - earlierDate.getTime()) / (1000 * 60 * 60);
};

/**
 * Format time remaining for user-friendly display
 * @param {number} hoursUntil - Hours until the event
 * @returns {string} Formatted time description (e.g., "45 minutes" or "2.5 hours")
 */
const formatTimeRemaining = (hoursUntil) => {
  const minutesRemaining = Math.round(hoursUntil * 60);
  return hoursUntil < 1
    ? `${minutesRemaining} minutes`
    : `${hoursUntil.toFixed(1)} hours`;
};

/**
 * Check if reservation can be modified (1 hour before original time rule)
 * @param {Date|string} originalDate - Original reservation date
 * @param {number} originalSlot - Original slot number
 * @param {Date} now - Current time (for testing purposes)
 * @returns {object} { canModify: boolean, hoursUntil: number, message?: string }
 */
const canModifyReservation = (originalDate, originalSlot, now = new Date()) => {
  const originalDateTime = createReservationDateTime(originalDate, originalSlot);

  if (!originalDateTime) {
    return {
      canModify: false,
      hoursUntil: 0,
      message: 'Invalid original slot time'
    };
  }

  const hoursUntil = getHoursDifference(originalDateTime, now);

  if (hoursUntil < 1) {
    return {
      canModify: false,
      hoursUntil,
      message: 'Cannot modify reservation less than 1 hour before the original time'
    };
  }

  return {
    canModify: true,
    hoursUntil
  };
};

/**
 * Check if new reservation time is valid (1 hour from now rule)
 * @param {Date|string} newDate - New reservation date
 * @param {number} newSlot - New slot number
 * @param {Date} now - Current time (for testing purposes)
 * @returns {object} { isValid: boolean, hoursUntil: number, message?: string }
 */
const isValidNewReservationTime = (newDate, newSlot, now = new Date()) => {
  const newDateTime = createReservationDateTime(newDate, newSlot);

  if (!newDateTime) {
    return {
      isValid: false,
      hoursUntil: 0,
      message: 'Invalid new slot time'
    };
  }

  const hoursUntil = getHoursDifference(newDateTime, now);

  if (hoursUntil < 1) {
    return {
      isValid: false,
      hoursUntil,
      message: 'New reservation time must be at least 1 hour from now'
    };
  }

  return {
    isValid: true,
    hoursUntil
  };
};

/**
 * Check if reservation can be cancelled (2 hours before rule)
 * @param {Date|string} reservationDate - Reservation date
 * @param {number} slotNumber - Slot number
 * @param {Date} now - Current time (for testing purposes)
 * @returns {object} { canCancel: boolean, hoursUntil: number, message?: string }
 */
const canCancelReservation = (reservationDate, slotNumber, now = new Date()) => {
  const reservationDateTime = createReservationDateTime(reservationDate, slotNumber);

  if (!reservationDateTime) {
    return {
      canCancel: false,
      hoursUntil: 0,
      message: 'Invalid reservation slot time'
    };
  }

  const hoursUntil = getHoursDifference(reservationDateTime, now);

  if (hoursUntil < 2) {
    return {
      canCancel: false,
      hoursUntil,
      message: 'Reservations can only be cancelled at least 2 hours in advance'
    };
  }

  return {
    canCancel: true,
    hoursUntil
  };
};

/**
 * Validate reservation update request
 * @param {object} reservation - Current reservation object
 * @param {object} updateData - Data to update { date?, slot?, ... }
 * @param {Date} now - Current time (for testing purposes)
 * @returns {object} { isValid: boolean, errors: string[], hoursUntil: number }
 */
const validateReservationUpdate = (reservation, updateData, now = new Date()) => {
  const errors = [];

  // Check if we can modify the original reservation
  const modifyCheck = canModifyReservation(reservation.date, reservation.slot, now);
  if (!modifyCheck.canModify) {
    errors.push(modifyCheck.message);
  }

  // If changing date or slot, validate new time
  if ((updateData.date || updateData.slot) && modifyCheck.canModify) {
    const newDate = updateData.date || reservation.date;
    const newSlot = updateData.slot || reservation.slot;

    const newTimeCheck = isValidNewReservationTime(newDate, newSlot, now);
    if (!newTimeCheck.isValid) {
      errors.push(newTimeCheck.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    hoursUntil: modifyCheck.hoursUntil
  };
};

// === TABLE BOOKING BUSINESS LOGIC ===

/**
 * Get bookings for a specific date from a table document
 * @param {object} table - Table document
 * @param {Date|string} date - Target date
 * @returns {object|null} Booking object or null if not found
 */
const getTableBookingsForDate = (table, date) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return table.tableBookings.find(booking => {
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);
    return bookingDate.getTime() === targetDate.getTime();
  });
};

/**
 * Check if a slot is available for a specific date on a table
 * @param {object} table - Table document
 * @param {Date|string} date - Target date
 * @param {number} slot - Slot number
 * @returns {boolean} True if slot is available
 */
const isTableSlotAvailable = (table, date, slot) => {
  const booking = getTableBookingsForDate(table, date);
  if (!booking) return true;

  // Check if any of the 3 consecutive slots are already booked
  return !booking.bookedSlots.includes(slot) &&
         !booking.bookedSlots.includes(slot + 1) &&
         !booking.bookedSlots.includes(slot + 2);
};

/**
 * Add booking for a specific date and slot to a table
 * @param {object} table - Table document
 * @param {Date|string} date - Target date
 * @param {number} slot - Slot number
 * @returns {Promise} Save operation promise
 */
const addTableBooking = async (table, date, slot) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  let booking = getTableBookingsForDate(table, targetDate);

  let slots = [slot, slot + 1, slot + 2];

  if (!booking) {
    booking = {
      date: targetDate,
      bookedSlots: slots
    };
    table.tableBookings.push(booking);
  } else {
    if (!booking.bookedSlots.includes(slot) && !booking.bookedSlots.includes(slot + 1) && !booking.bookedSlots.includes(slot + 2)) {
      booking.bookedSlots.push(...slots);
      booking.bookedSlots.sort();
    }
  }

  return table.save();
};

/**
 * Remove booking for a specific date and slot from a table
 * @param {object} table - Table document
 * @param {Date|string} date - Target date
 * @param {number} slot - Slot number
 * @returns {Promise} Save operation promise
 */
const removeTableBooking = async (table, date, slot) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const booking = getTableBookingsForDate(table, targetDate);

  if (booking) {
    booking.bookedSlots = booking.bookedSlots.filter(s => s !== slot && s !== slot + 1 && s !== slot + 2);

    if (booking.bookedSlots.length === 0) {
      table.tableBookings = table.tableBookings.filter(b =>
        new Date(b.date).getTime() !== targetDate.getTime()
      );
    }
  }

  return table.save();
};

/**
 * Find available tables for a specific date and slot
 * @param {Date|string} date - Target date
 * @param {number} slot - Slot number
 * @param {number} requiredCapacity - Minimum table capacity required
 * @param {string} excludeReservationId - Optional reservation ID to exclude (for edit mode)
 * @returns {Promise<Object>} Object with availableTables, occupiedTables, and notEligibleTables arrays
 */
const findAvailableTables = async (date, slot, requiredCapacity = 1, excludeReservationId = null) => {
  // Get all active tables
  const tables = await Table.find({
    isActive: true,
    capacity: { $gte: 1 }
  });

  const guests = parseInt(requiredCapacity, 10);
  const maxTableCapacity = guests + 1; // Accept max 1 extra seat per table

  // Find all confirmed/seated reservations for this date and slot
  // Use date range to match entire day (handles timezone/millisecond differences)
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // IMPORTANT: A reservation occupies 3 consecutive slots (slot, slot+1, slot+2)
  // For requested slot N, we need to find reservations with slot X where:
  // - X <= N <= X+2 (the reservation overlaps with our requested slot)
  // - Which means: N-2 <= X <= N
  const slotNumber = parseInt(slot, 10);
  const minOverlappingSlot = Math.max(1, slotNumber - 2); // Don't go below slot 1

  const query = {
    date: { $gte: startOfDay, $lte: endOfDay },
    slot: { $gte: minOverlappingSlot, $lte: slotNumber },
    status: { $in: ['confirmed', 'seated'] }
  };

  // Exclude specific reservation if provided (for edit mode)
  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const existingReservations = await Reservation.find(query);

  // Extract all occupied table numbers from reservations
  const occupiedTableNumbers = new Set();
  existingReservations.forEach(reservation => {
    if (reservation.tableNumber && Array.isArray(reservation.tableNumber)) {
      reservation.tableNumber.forEach(tableNum => occupiedTableNumbers.add(tableNum));
    }
  });

  const available = [];
  const occupied = [];
  const notEligible = [];

  tables.forEach(table => {
    const isOccupied = occupiedTableNumbers.has(table.tableNumber);
    const isEligible = table.capacity <= maxTableCapacity;

    if (isOccupied) {
      // Table is booked for this slot
      occupied.push(table.tableNumber);
    } else if (!isEligible) {
      // Table is available but too large for the number of guests
      notEligible.push(table.tableNumber);
    } else {
      // Table is available and suitable
      available.push(table.tableNumber);
    }
  });

  return {
    availableTables: available,
    occupiedTables: occupied,
    notEligibleTables: notEligible
  };
};

/**
 * Get table availability for a specific date
 * @param {Date|string} date - Target date
 * @returns {Promise<Array>} Array of availability information for all active tables
 */
const getTableAvailability = async (date) => {
  const tables = await Table.find({ isActive: true }).sort({ tableNumber: 1 });

  return tables.map(table => {
    const booking = getTableBookingsForDate(table, date);
    const bookedSlots = booking ? booking.bookedSlots : [];
    const availableSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter(slot =>
      isTableSlotAvailable(table, date, slot)
    );

    return {
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      bookedSlots,
      availableSlots,
      isFullyBooked: availableSlots.length === 0
    };
  });
};

/**
 * Validate that selected tables meet capacity requirements
 * Rules:
 * 1. Each table capacity must be <= guests + 1 (max 1 extra seat per table)
 * 2. Total capacity must be >= guests (enough seats)
 * 3. Total capacity must be <= guests + 1 (max 1 extra seat total)
 *
 * @param {Array<number>} tableNumbers - Array of table numbers
 * @param {number} guests - Number of guests
 * @returns {Promise<Object>} { valid: boolean, message: string, totalCapacity: number }
 */
const validateTableCapacity = async (tableNumbers, guests) => {
  if (!tableNumbers || tableNumbers.length === 0) {
    return {
      valid: false,
      message: 'At least one table must be selected',
      totalCapacity: 0
    };
  }

  // Fetch all selected tables
  const tables = await Table.find({
    tableNumber: { $in: tableNumbers },
    isActive: true
  });

  if (tables.length !== tableNumbers.length) {
    return {
      valid: false,
      message: 'One or more selected tables not found or inactive',
      totalCapacity: 0
    };
  }

  const maxTableCapacity = guests + 1;
  let totalCapacity = 0;

  // Check each table individually
  for (const table of tables) {
    totalCapacity += table.capacity;

    if (table.capacity > maxTableCapacity) {
      return {
        valid: false,
        message: `Table ${table.tableNumber} (capacity ${table.capacity}) is too large for ${guests} guests`,
        totalCapacity
      };
    }
  }

  // Check total capacity
  if (totalCapacity < guests) {
    return {
      valid: false,
      message: `Total capacity (${totalCapacity}) is insufficient for ${guests} guests`,
      totalCapacity
    };
  }

  if (totalCapacity > maxTableCapacity) {
    return {
      valid: false,
      message: `Total capacity (${totalCapacity}) exceeds maximum allowed (${maxTableCapacity}) for ${guests} guests`,
      totalCapacity
    };
  }

  return {
    valid: true,
    message: 'Table selection is valid',
    totalCapacity
  };
};

module.exports = {
  createReservationDateTime,
  getHoursDifference,
  formatTimeRemaining,
  canModifyReservation,
  isValidNewReservationTime,
  canCancelReservation,
  validateReservationUpdate,
  getTableBookingsForDate,
  isTableSlotAvailable,
  addTableBooking,
  removeTableBooking,
  findAvailableTables,
  getTableAvailability,
  validateTableCapacity
};