const Order = require('../models/Order');
const Reservation = require('../models/Reservation');

/**
 * Get date boundaries for statistics calculations
 * @returns {Object} Date boundaries for this month, last month, today, same day last week
 */
const getDateBoundaries = () => {
  const now = new Date();

  // This month: from 1st of current month at 00:00:00
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // Last month: from 1st to last day of previous month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Today: from 00:00:00 to 23:59:59
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Same day last week
  const sameDayLastWeekStart = new Date(todayStart);
  sameDayLastWeekStart.setDate(sameDayLastWeekStart.getDate() - 7);
  const sameDayLastWeekEnd = new Date(todayEnd);
  sameDayLastWeekEnd.setDate(sameDayLastWeekEnd.getDate() - 7);

  return {
    thisMonthStart,
    lastMonthStart,
    lastMonthEnd,
    todayStart,
    todayEnd,
    sameDayLastWeekStart,
    sameDayLastWeekEnd
  };
};

/**
 * Get order statistics for a date range
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range (optional, defaults to now)
 * @returns {Object} Order stats: total, revenue, pickup count, delivery count
 */
const getOrderStats = async (startDate, endDate = new Date()) => {
  const matchStage = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $nin: ['cancelled'] }
  };

  const result = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        revenue: { $sum: '$totalPrice' },
        pickup: {
          $sum: { $cond: [{ $eq: ['$orderType', 'pickup'] }, 1, 0] }
        },
        delivery: {
          $sum: { $cond: [{ $eq: ['$orderType', 'delivery'] }, 1, 0] }
        }
      }
    }
  ]);

  return result[0] || { total: 0, revenue: 0, pickup: 0, delivery: 0 };
};

/**
 * Get reservation statistics for a date range
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range (optional, defaults to now)
 * @returns {Object} Reservation stats: total, totalGuests
 */
const getReservationStats = async (startDate, endDate = new Date()) => {
  const matchStage = {
    date: { $gte: startDate, $lte: endDate },
    status: { $nin: ['cancelled', 'no-show'] }
  };

  const result = await Reservation.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalGuests: { $sum: '$guests' }
      }
    }
  ]);

  return result[0] || { total: 0, totalGuests: 0 };
};

/**
 * Get all dashboard statistics
 * @returns {Object} Complete dashboard statistics
 */
const getDashboardStats = async () => {
  const dates = getDateBoundaries();

  // Parallel execution for better performance
  const [
    ordersThisMonth,
    ordersLastMonth,
    ordersToday,
    ordersSameDayLastWeek,
    reservationsThisMonth,
    reservationsLastMonth,
    reservationsToday,
    reservationsSameDayLastWeek
  ] = await Promise.all([
    getOrderStats(dates.thisMonthStart),
    getOrderStats(dates.lastMonthStart, dates.lastMonthEnd),
    getOrderStats(dates.todayStart, dates.todayEnd),
    getOrderStats(dates.sameDayLastWeekStart, dates.sameDayLastWeekEnd),
    getReservationStats(dates.thisMonthStart),
    getReservationStats(dates.lastMonthStart, dates.lastMonthEnd),
    getReservationStats(dates.todayStart, dates.todayEnd),
    getReservationStats(dates.sameDayLastWeekStart, dates.sameDayLastWeekEnd)
  ]);

  return {
    orders: {
      thisMonth: {
        total: ordersThisMonth.total,
        revenue: ordersThisMonth.revenue,
        pickup: ordersThisMonth.pickup,
        delivery: ordersThisMonth.delivery
      },
      lastMonth: {
        total: ordersLastMonth.total,
        revenue: ordersLastMonth.revenue,
        pickup: ordersLastMonth.pickup,
        delivery: ordersLastMonth.delivery
      },
      today: {
        total: ordersToday.total,
        revenue: ordersToday.revenue,
        pickup: ordersToday.pickup,
        delivery: ordersToday.delivery
      },
      sameDayLastWeek: {
        total: ordersSameDayLastWeek.total,
        revenue: ordersSameDayLastWeek.revenue,
        pickup: ordersSameDayLastWeek.pickup,
        delivery: ordersSameDayLastWeek.delivery
      }
    },
    reservations: {
      thisMonth: {
        total: reservationsThisMonth.total,
        totalGuests: reservationsThisMonth.totalGuests
      },
      lastMonth: {
        total: reservationsLastMonth.total,
        totalGuests: reservationsLastMonth.totalGuests
      },
      today: {
        total: reservationsToday.total,
        totalGuests: reservationsToday.totalGuests
      },
      sameDayLastWeek: {
        total: reservationsSameDayLastWeek.total,
        totalGuests: reservationsSameDayLastWeek.totalGuests
      }
    },
    revenue: {
      thisMonth: ordersThisMonth.revenue,
      lastMonth: ordersLastMonth.revenue,
      today: ordersToday.revenue,
      sameDayLastWeek: ordersSameDayLastWeek.revenue
    }
  };
};

module.exports = {
  getDateBoundaries,
  getOrderStats,
  getReservationStats,
  getDashboardStats
};
