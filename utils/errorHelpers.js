const ERROR_CODES = require('../constants/errorCodes');
const GLOBAL_VAR = require('../constants/global');
const { formatTimeRemaining } = require('./reservationHelpers');

/**
 * Error Helpers - Utility functions to build standardized error responses
 *
 * These helpers create consistent error structures that the frontend
 * InlineAlert component can parse and display intelligently.
 *
 * Standard format:
 * {
 *   success: false,
 *   error: "User-facing message",
 *   code: "ERROR_CODE",
 *   details: {
 *     message: "Additional explanation",
 *     // ... other contextual data
 *   }
 * }
 */

// ========================================
// AUTHENTICATION ERRORS
// ========================================

/**
 * Create an invalid credentials error
 * @param {string} email - User email (optional, for logging)
 * @returns {Object} Structured error response
 */
const createInvalidCredentialsError = (email = null) => {
  if (email) {
    return {
      success: false,
      error: 'Invalid email',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      details: {
        message: 'Please check your email and try again.',
        field: 'email'
      }
    };
  } else {
    return {
      success: false,
      error: 'Invalid password',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      details: {
        message: 'Please check your password and try again.',
        field: 'password'
      }
    };
  }
};

/**
 * Create an email already exists error
 * @param {string} email - The email that already exists
 * @returns {Object} Structured error response
 */
const createEmailExistsError = (email) => {
  return {
    success: false,
    error: 'This email is already registered',
    code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
    details: {
      field: 'email',
      value: email,
      message: 'An account with this email already exists.',
      suggestion: 'Try logging in instead, or use password reset if you forgot your password.',
    }
  };
};

/**
 * Create an account deleted error
 * @returns {Object} Structured error response
 */
const createAccountDeletedError = () => {
  return {
    success: false,
    error: 'This account has been deleted',
    code: ERROR_CODES.AUTH_ACCOUNT_DELETED,
    details: {
      message: 'This account has been permanently deleted.',
      suggestion: 'Please contact support if you believe this is an error.',
      contactEmail: 'support@restoh.com'
    }
  };
};

/**
 * Create an account inactive error
 * @returns {Object} Structured error response
 */
const createAccountInactiveError = () => {
  return {
    success: false,
    error: 'Your account has been deactivated',
    code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
    details: {
      message: 'Your account has been deactivated by an administrator.',
      suggestion: 'Please use the contact form to speak with an administrator and resolve this issue.',
      contactEmail: 'support@restoh.com',
      contactPhone: '+33 1 23 45 67 89'
    }
  };
};

/**
 * Create an account locked error (too many failed login attempts)
 * @param {number} remainingMinutes - Minutes until unlock
 * @returns {Object} Structured error response
 */
const createAccountLockedError = (remainingMinutes) => {
  return {
    success: false,
    error: 'Account temporarily locked',
    code: ERROR_CODES.AUTH_ACCOUNT_LOCKED,
    details: {
      message: `Too many failed login attempts. Your account has been temporarily locked for security reasons.`,
      remainingMinutes,
      suggestion: `Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
      tip: 'If you forgot your password, use the password reset feature.'
    }
  };
};

// ========================================
// RESERVATION ERRORS
// ========================================

/**
 * Create a tables unavailable error
 * @param {Array<number>} unavailableTables - Table numbers that are not available
 * @param {Array<number>} suggestedTables - Alternative table suggestions
 * @returns {Object} Structured error response
 */
const createTablesUnavailableError = (unavailableTables, suggestedTables = []) => {
  const tablesList = unavailableTables.length === 1
    ? `Table ${unavailableTables[0]} is`
    : `Tables ${unavailableTables.join(' and ')} are`;

  return {
    success: false,
    error: `${tablesList} no longer available`,
    code: ERROR_CODES.TABLES_UNAVAILABLE,
    details: {
      unavailableTables,
      message: 'These tables were just booked by another customer.',
      suggestedTables
    }
  };
};

/**
 * Create a capacity exceeded error
 * @param {number} guests - Number of guests
 * @param {Array<number>} selectedTables - Selected table numbers
 * @param {number} totalCapacity - Total capacity of selected tables
 * @param {number} maxAllowed - Maximum allowed capacity
 * @param {Array<number>} suggestedTables - Alternative table suggestions
 * @returns {Object} Structured error response
 */
const createCapacityExceededError = (guests, selectedTables, totalCapacity, maxAllowed, suggestedTables = []) => {
  return {
    success: false,
    error: `Total capacity (${totalCapacity}) exceeds maximum allowed (${maxAllowed}) for ${guests} guests`,
    code: ERROR_CODES.CAPACITY_EXCEEDED,
    details: {
      guests,
      selectedTables,
      totalCapacity,
      maxAllowed,
      message: `You selected tables with ${totalCapacity} total seats for ${guests} guests. Maximum allowed is ${maxAllowed} seats (party size + 1).`,
      rule: 'Total capacity must not exceed party size + 1',
      suggestedTables
    }
  };
};

/**
 * Create a table capacity error (single table too large)
 * @param {number} tableNumber - Table number
 * @param {number} tableCapacity - Table capacity
 * @param {number} guests - Number of guests
 * @param {Array<number>} suggestedTables - Alternative table suggestions
 * @returns {Object} Structured error response
 */
const createInvalidTableCapacityError = (tableNumber, tableCapacity, guests, suggestedTables = []) => {
  const maxAllowed = guests + 1;

  return {
    success: false,
    error: `Table ${tableNumber} (capacity ${tableCapacity}) is too large for ${guests} guests`,
    code: ERROR_CODES.INVALID_TABLE_CAPACITY,
    details: {
      tableNumber,
      tableCapacity,
      guests,
      maxAllowed,
      message: `This table has ${tableCapacity} seats, which exceeds the maximum of ${maxAllowed} allowed for ${guests} guests.`,
      rule: 'Individual table capacity cannot exceed party size + 1',
      suggestedTables
    }
  };
};

/**
 * Create a capacity insufficient error
 * @param {number} guests - Number of guests
 * @param {Array<number>} selectedTables - Selected table numbers
 * @param {number} totalCapacity - Total capacity of selected tables
 * @param {Array<number>} suggestedTables - Alternative table suggestions
 * @returns {Object} Structured error response
 */
const createCapacityInsufficientError = (guests, selectedTables, totalCapacity, suggestedTables = []) => {
  return {
    success: false,
    error: `Total capacity (${totalCapacity}) is insufficient for ${guests} guests`,
    code: ERROR_CODES.CAPACITY_INSUFFICIENT,
    details: {
      guests,
      selectedTables,
      totalCapacity,
      needed: guests,
      message: `The selected tables have only ${totalCapacity} seats, but you need ${guests} seats for your party.`,
      suggestedTables
    }
  };
};

/**
 * Create a cancellation too late error
 * @param {number} hoursUntil - Hours until reservation
 * @param {string} contactPhone - Restaurant contact phone
 * @returns {Object} Structured error response
 */
const createCancellationTooLateError = (hoursUntil, contactPhone = GLOBAL_VAR.PHONE_NUMBER) => {
  const timeDescription = formatTimeRemaining(hoursUntil);

  return {
    success: false,
    error: 'Cannot cancel reservation less than 2 hours before scheduled time',
    code: ERROR_CODES.CANCELLATION_TOO_LATE,
    details: {
      hoursRemaining: hoursUntil,
      message: `Your reservation is in ${timeDescription}. Free cancellation is only available up to 2 hours before.`,
      policy: 'Free cancellation available up to 2 hours before your reservation',
      contactPhone,
      action: `Please contact us directly to discuss your reservation at ${contactPhone}`
    }
  };
};

/**
 * Create a modification too late error
 * @param {number} hoursUntil - Hours until reservation
 * @param {string} contactPhone - Restaurant contact phone
 * @returns {Object} Structured error response
 */
const createModificationTooLateError = (hoursUntil, contactPhone = GLOBAL_VAR.PHONE_NUMBER) => {
  const timeDescription = formatTimeRemaining(hoursUntil);

  return {
    success: false,
    error: 'Cannot modify reservation less than 1 hour before the original time',
    code: ERROR_CODES.MODIFICATION_TOO_LATE,
    details: {
      hoursRemaining: hoursUntil,
      message: `Your reservation is in ${timeDescription}. Modifications must be made at least 1 hour in advance.`,
      policy: 'Reservations can be modified up to 1 hour before the scheduled time',
      contactPhone,
      action: `For last-minute modifications, please call us directly at ${contactPhone}`
    }
  };
};

/**
 * Create a reservation too late error (new reservation)
 * @param {number} hoursUntil - Hours until requested time
 * @param {string} contactPhone - Restaurant contact phone
 * @returns {Object} Structured error response
 */
const createReservationTooLateError = (hoursUntil, contactPhone = '+33 1 23 45 67 89') => {
  return {
    success: false,
    error: 'New reservation time must be at least 1 hour from now',
    code: ERROR_CODES.RESERVATION_TOO_LATE,
    details: {
      hoursUntil,
      minimumAdvance: 1,
      message: 'Reservations must be made at least 1 hour in advance.',
      contactPhone,
      action: `For last-minute reservations, please call us directly at ${contactPhone}`
    }
  };
};

// ========================================
// USER MANAGEMENT ERRORS
// ========================================

/**
 * Create a user not found error
 * @param {string} userId - User ID that was not found
 * @returns {Object} Structured error response
 */
const createUserNotFoundError = (userId = null) => {
  return {
    success: false,
    error: 'User not found',
    code: ERROR_CODES.USER_NOT_FOUND,
    details: {
      userId,
      message: 'The requested user does not exist or has been deleted.',
      suggestion: 'Check the user ID or contact support if you believe this is an error.'
    }
  };
};

/**
 * Create a user already deleted error
 * @param {string} userId - User ID
 * @returns {Object} Structured error response
 */
const createUserAlreadyDeletedError = (userId = null) => {
  return {
    success: false,
    error: 'This account is already deleted',
    code: ERROR_CODES.USER_ALREADY_DELETED,
    details: {
      userId,
      message: 'This user account has already been deleted.',
      suggestion: 'No further action is needed.'
    }
  };
};

/**
 * Create a cannot modify deleted account error
 * @param {string} userId - User ID
 * @returns {Object} Structured error response
 */
const createCannotModifyDeletedAccountError = (userId = null) => {
  return {
    success: false,
    error: 'Cannot modify a deleted account',
    code: ERROR_CODES.CANNOT_MODIFY_DELETED_ACCOUNT,
    details: {
      userId,
      message: 'This account has been deleted and cannot be modified.',
      suggestion: 'Deleted accounts are archived and cannot be edited.'
    }
  };
};

/**
 * Create a cannot delete own account error
 * @returns {Object} Structured error response
 */
const createCannotDeleteOwnAccountError = () => {
  return {
    success: false,
    error: 'Cannot delete your own account',
    code: ERROR_CODES.CANNOT_DELETE_OWN_ACCOUNT,
    details: {
      message: 'You cannot delete your own administrator account.',
      suggestion: 'Ask another administrator to delete your account if needed.'
    }
  };
};

// ========================================
// TABLE ERRORS
// ========================================

/**
 * Create a table not found error
 * @param {string} tableId - Table ID that was not found
 * @returns {Object} Structured error response
 */
const createTableNotFoundError = (tableId = null) => {
  return {
    success: false,
    error: 'Table not found',
    code: ERROR_CODES.TABLE_NOT_FOUND,
    details: {
      tableId,
      message: 'The requested table does not exist.',
      suggestion: 'Check the table ID or view available tables.'
    }
  };
};

/**
 * Create a date required error
 * @returns {Object} Structured error response
 */
const createDateRequiredError = () => {
  return {
    success: false,
    error: 'Date parameter is required',
    code: ERROR_CODES.DATE_REQUIRED,
    details: {
      field: 'date',
      message: 'You must provide a date to check table availability.',
      format: 'YYYY-MM-DD',
      example: '2024-12-25'
    }
  };
};

/**
 * Create a date and slot required error
 * @returns {Object} Structured error response
 */
const createDateAndSlotRequiredError = () => {
  return {
    success: false,
    error: 'Date and slot parameters are required',
    code: ERROR_CODES.DATE_AND_SLOT_REQUIRED,
    details: {
      requiredFields: ['date', 'slot'],
      message: 'Both date and time slot are required to find available tables.',
      dateFormat: 'YYYY-MM-DD',
      slotRange: { min: 1, max: 15 }
    }
  };
};

/**
 * Create an invalid slot number error
 * @param {number} providedSlot - The invalid slot number provided
 * @param {number} maxSlot - Maximum allowed slot
 * @returns {Object} Structured error response
 */
const createInvalidSlotNumberError = (providedSlot = null, maxSlot = 15) => {
  return {
    success: false,
    error: `Slot must be between 1 and ${maxSlot}`,
    code: ERROR_CODES.INVALID_SLOT_NUMBER,
    details: {
      field: 'slot',
      providedValue: providedSlot,
      validRange: { min: 1, max: maxSlot },
      message: `Time slot must be between 1 and ${maxSlot}.`
    }
  };
};

// ========================================
// PAYMENT ERRORS
// ========================================

/**
 * Create an invalid amount error
 * @param {number} providedAmount - The invalid amount provided
 * @returns {Object} Structured error response
 */
const createInvalidAmountError = (providedAmount = null) => {
  return {
    success: false,
    error: 'Valid amount is required',
    code: ERROR_CODES.INVALID_AMOUNT,
    details: {
      field: 'amount',
      providedValue: providedAmount,
      message: 'Payment amount must be a positive number greater than 0.',
      suggestion: 'Provide a valid amount in the currency specified.'
    }
  };
};

/**
 * Create a payment intent ID required error
 * @returns {Object} Structured error response
 */
const createPaymentIntentIdRequiredError = () => {
  return {
    success: false,
    error: 'Payment intent ID is required',
    code: ERROR_CODES.PAYMENT_INTENT_ID_REQUIRED,
    details: {
      field: 'paymentIntentId',
      message: 'You must provide a payment intent ID to confirm the payment.',
      suggestion: 'Create a payment intent first, then use the returned ID to confirm.'
    }
  };
};

/**
 * Create a payment intent creation failed error
 * @param {string} reason - Reason for failure
 * @returns {Object} Structured error response
 */
const createPaymentIntentCreationFailedError = (reason = 'Unknown error') => {
  return {
    success: false,
    error: 'Failed to create payment intent',
    code: ERROR_CODES.PAYMENT_INTENT_CREATION_FAILED,
    details: {
      reason,
      message: 'Unable to initialize the payment process.',
      suggestion: 'Please try again or contact support if the problem persists.',
      contactSupport: 'support@restoh.com'
    }
  };
};

/**
 * Create a payment not completed error
 * @param {string} currentStatus - Current payment status
 * @returns {Object} Structured error response
 */
const createPaymentNotCompletedError = (currentStatus = 'unknown') => {
  return {
    success: false,
    error: 'Payment not completed',
    code: ERROR_CODES.PAYMENT_NOT_COMPLETED,
    details: {
      currentStatus,
      message: `The payment is currently ${currentStatus} and has not been completed.`,
      suggestion: 'Please complete the payment process or try again.',
      possibleStatuses: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'canceled']
    }
  };
};

/**
 * Create a payment confirmation failed error
 * @param {string} reason - Reason for failure
 * @returns {Object} Structured error response
 */
const createPaymentConfirmationFailedError = (reason = 'Unknown error') => {
  return {
    success: false,
    error: 'Failed to confirm payment',
    code: ERROR_CODES.PAYMENT_CONFIRMATION_FAILED,
    details: {
      reason,
      message: 'Unable to verify the payment status.',
      suggestion: 'Please try again or contact support if the problem persists.',
      contactSupport: 'support@restoh.com'
    }
  };
};

// ========================================
// MENU ERRORS
// ========================================

/**
 * Create a menu item not found error
 * @param {string} menuItemId - Menu item ID that was not found
 * @returns {Object} Structured error response
 */
const createMenuItemNotFoundError = (menuItemId = null) => {
  return {
    success: false,
    error: 'Menu item not found',
    code: ERROR_CODES.MENU_ITEM_NOT_FOUND,
    details: {
      menuItemId,
      message: 'The requested menu item does not exist or has been removed.',
      suggestion: 'Check the menu item ID or browse our menu for available items.'
    }
  };
};

/**
 * Create a nothing to update error
 * @returns {Object} Structured error response
 */
const createMenuNothingToUpdateError = () => {
  return {
    success: false,
    error: 'Nothing to modify',
    code: ERROR_CODES.MENU_NOTHING_TO_UPDATE,
    details: {
      message: 'No fields were provided to update.',
      suggestion: 'Provide at least one field to update (name, price, description, etc.).'
    }
  };
};

/**
 * Create an invalid rating error
 * @param {number} providedRating - The invalid rating provided
 * @returns {Object} Structured error response
 */
const createInvalidRatingError = (providedRating = null) => {
  return {
    success: false,
    error: 'Rating must be between 1 and 5',
    code: ERROR_CODES.INVALID_RATING,
    details: {
      field: 'rating',
      providedValue: providedRating,
      validRange: { min: 1, max: 5 },
      message: 'Please provide a rating between 1 (poor) and 5 (excellent).'
    }
  };
};

/**
 * Create a review already exists error
 * @param {string} menuItemId - Menu item ID
 * @returns {Object} Structured error response
 */
const createReviewAlreadyExistsError = (menuItemId = null) => {
  return {
    success: false,
    error: 'You have already reviewed this item',
    code: ERROR_CODES.REVIEW_ALREADY_EXISTS,
    details: {
      menuItemId,
      message: 'You can only submit one review per menu item.',
      suggestion: 'To change your review, please contact support or delete your existing review first.'
    }
  };
};

/**
 * Create a review not found error
 * @param {string} reviewId - Review ID that was not found
 * @returns {Object} Structured error response
 */
const createReviewNotFoundError = (reviewId = null) => {
  return {
    success: false,
    error: 'Review not found',
    code: ERROR_CODES.REVIEW_NOT_FOUND,
    details: {
      reviewId,
      message: 'The requested review does not exist or has been deleted.',
      suggestion: 'Check the review ID or view the list of reviews.'
    }
  };
};

/**
 * Create an unauthorized review update error
 * @returns {Object} Structured error response
 */
const createUnauthorizedReviewUpdateError = () => {
  return {
    success: false,
    error: 'You can only modify your own reviews',
    code: ERROR_CODES.UNAUTHORIZED_REVIEW_UPDATE,
    details: {
      message: 'You do not have permission to modify this review.',
      suggestion: 'You can only update or delete reviews that you created.'
    }
  };
};

// ========================================
// ORDER ERRORS
// ========================================

/**
 * Create an empty items error
 * @returns {Object} Structured error response
 */
const createOrderEmptyItemsError = () => {
  return {
    success: false,
    error: 'Order must contain at least one item',
    code: ERROR_CODES.ORDER_EMPTY_ITEMS,
    details: {
      field: 'items',
      message: 'You cannot place an order without any items.',
      suggestion: 'Add items to your cart before placing an order.'
    }
  };
};

/**
 * Create an invalid order type error
 * @param {string} providedType - The invalid type provided
 * @param {Array<string>} validTypes - Valid order types
 * @returns {Object} Structured error response
 */
const createOrderInvalidTypeError = (providedType, validTypes = ['pickup', 'delivery']) => {
  return {
    success: false,
    error: `Invalid order type: ${providedType}`,
    code: ERROR_CODES.ORDER_INVALID_TYPE,
    details: {
      field: 'orderType',
      providedValue: providedType,
      validValues: validTypes,
      message: `Order type must be one of: ${validTypes.join(', ')}.`
    }
  };
};

/**
 * Create a missing delivery address error
 * @returns {Object} Structured error response
 */
const createOrderMissingDeliveryAddressError = () => {
  return {
    success: false,
    error: 'Delivery address is required for delivery orders',
    code: ERROR_CODES.ORDER_MISSING_DELIVERY_ADDRESS,
    details: {
      field: 'deliveryAddress',
      message: 'For delivery orders, you must provide a complete delivery address.',
      requiredFields: ['street', 'city', 'zipCode'],
      suggestion: 'Update your profile with a delivery address or choose a different order type.'
    }
  };
};

/**
 * Create an order not found error
 * @param {string} orderId - Order ID that was not found
 * @returns {Object} Structured error response
 */
const createOrderNotFoundError = (orderId = null) => {
  return {
    success: false,
    error: 'Order not found',
    code: ERROR_CODES.ORDER_NOT_FOUND,
    details: {
      orderId,
      message: 'The requested order does not exist or has been deleted.',
      suggestion: 'Check your order history or contact support if you believe this is an error.'
    }
  };
};

/**
 * Create an invalid order status error
 * @param {string} currentStatus - Current order status
 * @param {string} attemptedStatus - Status user tried to set
 * @param {Array<string>} validTransitions - Valid status transitions from current status
 * @returns {Object} Structured error response
 */
const createOrderInvalidStatusError = (currentStatus, attemptedStatus, validTransitions = []) => {
  return {
    success: false,
    error: `Cannot change order status from ${currentStatus} to ${attemptedStatus}`,
    code: ERROR_CODES.ORDER_INVALID_STATUS,
    details: {
      currentStatus,
      attemptedStatus,
      validTransitions,
      message: validTransitions.length > 0
        ? `This order is currently ${currentStatus}. Valid transitions are: ${validTransitions.join(', ')}.`
        : `This order is ${currentStatus} and cannot be modified.`
    }
  };
};

/**
 * Create a payment failed error
 * @param {string} reason - Reason for payment failure
 * @param {Object} paymentDetails - Additional payment details
 * @returns {Object} Structured error response
 */
const createPaymentFailedError = (reason = 'Unknown error', paymentDetails = {}) => {
  return {
    success: false,
    error: 'Payment processing failed',
    code: ERROR_CODES.PAYMENT_FAILED,
    details: {
      reason,
      message: 'We were unable to process your payment.',
      suggestion: 'Please check your payment details and try again, or contact your bank.',
      contactSupport: 'support@restoh.com',
      ...paymentDetails
    }
  };
};

/**
 * Create a menu item unavailable error
 * @param {string} itemName - Name of unavailable item
 * @param {string} itemId - ID of unavailable item
 * @returns {Object} Structured error response
 */
const createMenuItemUnavailableError = (itemName, itemId = null) => {
  return {
    success: false,
    error: `${itemName} is currently unavailable`,
    code: ERROR_CODES.MENU_ITEM_UNAVAILABLE,
    details: {
      itemName,
      itemId,
      message: 'This item is temporarily unavailable and cannot be ordered.',
      suggestion: 'Please remove this item from your order or choose a substitute.'
    }
  };
};

// ========================================
// CONTACT ERRORS
// ========================================

/**
 * Create a contact message not found error
 * @param {string} messageId - Message ID that was not found
 * @returns {Object} Structured error response
 */
const createContactMessageNotFoundError = (messageId = null) => {
  return {
    success: false,
    error: 'Contact message not found',
    code: ERROR_CODES.CONTACT_MESSAGE_NOT_FOUND,
    details: {
      messageId,
      message: 'The requested contact message does not exist or has been deleted.',
      suggestion: 'Check the message ID or view the list of contact messages.'
    }
  };
};

// ========================================
// GENERIC ERRORS
// ========================================

/**
 * Create a generic validation error
 * @param {string} message - Error message
 * @param {Object} validationDetails - Validation error details
 * @returns {Object} Structured error response
 */
const createValidationError = (message, validationDetails = {}) => {
  return {
    success: false,
    error: message,
    code: ERROR_CODES.VALIDATION_ERROR,
    details: validationDetails
  };
};

/**
 * Create a server error response
 * @param {string} message - Error message
 * @param {number} retryAfter - Seconds to wait before retry
 * @returns {Object} Structured error response
 */
const createServerError = (message = 'Server temporarily unavailable', retryAfter = 30) => {
  return {
    success: false,
    error: message,
    code: ERROR_CODES.SERVER_ERROR,
    details: {
      retryAfter,
      message: 'Our servers are experiencing high traffic. Please try again in a moment.'
    }
  };
};

module.exports = {
  // Authentication
  createInvalidCredentialsError,
  createEmailExistsError,
  createAccountDeletedError,
  createAccountInactiveError,
  createAccountLockedError,

  // User Management
  createUserNotFoundError,
  createUserAlreadyDeletedError,
  createCannotModifyDeletedAccountError,
  createCannotDeleteOwnAccountError,

  // Tables
  createTableNotFoundError,
  createDateRequiredError,
  createDateAndSlotRequiredError,
  createInvalidSlotNumberError,

  // Payment
  createInvalidAmountError,
  createPaymentIntentIdRequiredError,
  createPaymentIntentCreationFailedError,
  createPaymentNotCompletedError,
  createPaymentConfirmationFailedError,

  // Menu
  createMenuItemNotFoundError,
  createMenuNothingToUpdateError,
  createInvalidRatingError,
  createReviewAlreadyExistsError,
  createReviewNotFoundError,
  createUnauthorizedReviewUpdateError,

  // Reservations
  createTablesUnavailableError,
  createCapacityExceededError,
  createInvalidTableCapacityError,
  createCapacityInsufficientError,
  createCancellationTooLateError,
  createModificationTooLateError,
  createReservationTooLateError,

  // Orders
  createOrderEmptyItemsError,
  createOrderInvalidTypeError,
  createOrderMissingDeliveryAddressError,
  createOrderNotFoundError,
  createOrderInvalidStatusError,
  createPaymentFailedError,
  createMenuItemUnavailableError,

  // Contact
  createContactMessageNotFoundError,

  // Generic
  createValidationError,
  createServerError
};
