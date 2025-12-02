const MenuItem = require('../models/MenuItem');

// Popular items distribution by category
const POPULAR_DISTRIBUTION = {
  appetizer: 2,
  main: 3,
  dessert: 1,
  beverage: 2
};

/**
 * Get popular items according to category distribution
 * Selects top N by orderCount for each category
 * Excludes items with isPopularOverride: true or isAvailable: false
 *
 * @returns {Promise<Array>} List of popular items (8 items max)
 */
const getPopularItems = async () => {
  const categories = Object.keys(POPULAR_DISTRIBUTION);
  const popularItems = [];

  // For each category, get top N items
  for (const category of categories) {
    const limit = POPULAR_DISTRIBUTION[category];

    const items = await MenuItem.find({
      category,
      isAvailable: true,
      isPopularOverride: false  // Exclude overridden items
    })
      .sort({ orderCount: -1 })
      .limit(limit);

    popularItems.push(...items);
  }

  return popularItems;
};

/**
 * Get popular items with a single aggregation query
 * More performant than the for loop version
 *
 * @returns {Promise<Array>} List of popular items (8 items max)
 */
const getPopularItemsAggregated = async () => {
  const pipeline = [
    // Filter available and non-overridden items
    {
      $match: {
        isAvailable: true,
        isPopularOverride: false
      }
    },
    // Sort by orderCount descending
    {
      $sort: { orderCount: -1 }
    },
    // Group by category and keep top N
    {
      $group: {
        _id: '$category',
        items: { $push: '$$ROOT' }
      }
    },
    // Limit each category according to POPULAR_DISTRIBUTION
    {
      $project: {
        category: '$_id',
        items: {
          $slice: [
            '$items',
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id', 'appetizer'] }, then: POPULAR_DISTRIBUTION.appetizer },
                  { case: { $eq: ['$_id', 'main'] }, then: POPULAR_DISTRIBUTION.main },
                  { case: { $eq: ['$_id', 'dessert'] }, then: POPULAR_DISTRIBUTION.dessert },
                  { case: { $eq: ['$_id', 'beverage'] }, then: POPULAR_DISTRIBUTION.beverage }
                ],
                default: 0
              }
            }
          ]
        }
      }
    },
    // Unwind items
    {
      $unwind: '$items'
    },
    // Replace root with item
    {
      $replaceRoot: { newRoot: '$items' }
    },
    // Sort final result by category then orderCount
    {
      $sort: { category: 1, orderCount: -1 }
    }
  ];

  return MenuItem.aggregate(pipeline);
};

/**
 * Get popular item IDs (Set for O(1) lookup)
 * @returns {Promise<Set<string>>} Set of popular IDs
 */
const getPopularItemIds = async () => {
  const popularItems = await getPopularItems();
  return new Set(popularItems.map(item => item._id.toString()));
};

/**
 * Enrich an item with calculated isPopular
 * @param {Object} item - MenuItem (document or object)
 * @param {Set<string>} popularIds - Set of popular IDs
 * @returns {Object} Item enriched with isPopular
 */
const enrichWithIsPopular = (item, popularIds) => {
  const obj = item.toObject ? item.toObject() : item;
  return {
    ...obj,
    isPopular: popularIds.has(obj.id?.toString() || obj._id?.toString())
  };
};

/**
 * Enrich a list of items with calculated isPopular
 * @param {Array} items - List of MenuItems
 * @returns {Promise<Array>} Items enriched with isPopular
 */
const enrichItemsWithIsPopular = async (items) => {
  const popularIds = await getPopularItemIds();
  return items.map(item => enrichWithIsPopular(item, popularIds));
};

/**
 * Enrich a single item with calculated isPopular
 * @param {Object} item - MenuItem
 * @returns {Promise<Object>} Item enriched with isPopular
 */
const enrichItemWithIsPopular = async (item) => {
  const popularIds = await getPopularItemIds();
  return enrichWithIsPopular(item, popularIds);
};

module.exports = {
  POPULAR_DISTRIBUTION,
  getPopularItems,
  getPopularItemsAggregated,
  getPopularItemIds,
  enrichItemsWithIsPopular,
  enrichItemWithIsPopular
};
