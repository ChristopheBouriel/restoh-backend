/**
 * Time slots configuration for reservations
 * Format: { slot: number, label: string }
 * The slot number is sent to/from the frontend
 *
 * Slots 1-6: Lunch service (11:00-13:30)
 * Slots 7-15: Dinner service (18:00-22:00)
 */

const TIME_SLOTS = [
  // Lunch service
  { slot: 1, label: '11:00' },
  { slot: 2, label: '11:30' },
  { slot: 3, label: '12:00' },
  { slot: 4, label: '12:30' },
  { slot: 5, label: '13:00' },
  { slot: 6, label: '13:30' },

  // Dinner service
  { slot: 7, label: '18:00' },
  { slot: 8, label: '18:30' },
  { slot: 9, label: '19:00' },
  { slot: 10, label: '19:30' },
  { slot: 11, label: '20:00' },
  { slot: 12, label: '20:30' },
  { slot: 13, label: '21:00' },
  { slot: 14, label: '21:30' },
  { slot: 15, label: '22:00' }
];

/**
 * Get time label from slot number
 * @param {number} slotNumber - Slot number
 * @returns {string} Time label or 'N/A' if not found
 */
const getLabelFromSlot = (slotNumber) => {
  const slot = TIME_SLOTS.find(s => s.slot === slotNumber);
  return slot ? slot.label : 'N/A';
};

/**
 * Get full slot object from slot number
 * @param {number} slotNumber - Slot number
 * @returns {object|null} Slot object or null if not found
 */
const getSlotByNumber = (slotNumber) => {
  return TIME_SLOTS.find(s => s.slot === slotNumber) || null;
};

/**
 * Validate if slot number exists
 * @param {number} slotNumber - Slot number to validate
 * @returns {boolean} True if valid slot
 */
const isValidSlot = (slotNumber) => {
  return TIME_SLOTS.some(s => s.slot === slotNumber);
};

/**
 * Get all available time slots
 * @returns {Array} Array of all time slots
 */
const getAllTimeSlots = () => {
  return [...TIME_SLOTS];
};

/**
 * Convert slot number to time components (hours, minutes)
 * @param {number} slotNumber - Slot number
 * @returns {object|null} Object with hours and minutes, or null if invalid
 */
const getTimeFromSlot = (slotNumber) => {
  const slot = getSlotByNumber(slotNumber);
  if (!slot) return null;

  const [hours, minutes] = slot.label.split(':');
  return {
    hours: parseInt(hours, 10),
    minutes: parseInt(minutes, 10)
  };
};

/**
 * Get full datetime from reservation date and slot
 * @param {Date|string} date - Reservation date
 * @param {number} slotNumber - Slot number
 * @returns {Date|null} Full datetime or null if invalid
 */
const getReservationDateTime = (date, slotNumber) => {
  const time = getTimeFromSlot(slotNumber);
  if (!time) return null;

  const reservationDate = new Date(date);
  reservationDate.setHours(time.hours, time.minutes, 0, 0);
  return reservationDate;
};

/**
 * Check if current time is before reservation time
 * @param {Date|string} date - Reservation date
 * @param {number} slotNumber - Slot number
 * @returns {boolean} True if current time is before reservation
 */
const isBeforeReservationTime = (date, slotNumber) => {
  const reservationDateTime = getReservationDateTime(date, slotNumber);
  if (!reservationDateTime) return false;
  return new Date() < reservationDateTime;
};

/**
 * Check if current time is after reservation time
 * @param {Date|string} date - Reservation date
 * @param {number} slotNumber - Slot number
 * @returns {boolean} True if current time is after reservation
 */
const isAfterReservationTime = (date, slotNumber) => {
  const reservationDateTime = getReservationDateTime(date, slotNumber);
  if (!reservationDateTime) return false;
  return new Date() >= reservationDateTime;
};

module.exports = {
  TIME_SLOTS,
  getLabelFromSlot,
  getSlotByNumber,
  isValidSlot,
  getAllTimeSlots,
  getTimeFromSlot,
  getReservationDateTime,
  isBeforeReservationTime,
  isAfterReservationTime
};