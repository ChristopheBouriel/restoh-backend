const MenuItem = require('../models/MenuItem');

// Distribution des items populaires par catégorie
const POPULAR_DISTRIBUTION = {
  appetizer: 2,
  main: 3,
  dessert: 1,
  beverage: 2
};

/**
 * Récupère les items populaires selon la distribution par catégorie
 * Sélectionne les top N par orderCount pour chaque catégorie
 * Exclut les items avec isPopularOverride: true ou isAvailable: false
 *
 * @returns {Promise<Array>} Liste des items populaires (8 items max)
 */
const getPopularItems = async () => {
  const categories = Object.keys(POPULAR_DISTRIBUTION);
  const popularItems = [];

  // Pour chaque catégorie, récupérer les top N items
  for (const category of categories) {
    const limit = POPULAR_DISTRIBUTION[category];

    const items = await MenuItem.find({
      category,
      isAvailable: true,
      isPopularOverride: false  // Exclure les items overridés
    })
      .sort({ orderCount: -1 })
      .limit(limit);

    popularItems.push(...items);
  }

  return popularItems;
};

/**
 * Récupère les items populaires avec une seule requête agrégée
 * Plus performant que la version avec boucle for
 *
 * @returns {Promise<Array>} Liste des items populaires (8 items max)
 */
const getPopularItemsAggregated = async () => {
  const pipeline = [
    // Filtrer les items disponibles et non overridés
    {
      $match: {
        isAvailable: true,
        isPopularOverride: false
      }
    },
    // Trier par orderCount décroissant
    {
      $sort: { orderCount: -1 }
    },
    // Grouper par catégorie et garder les top N
    {
      $group: {
        _id: '$category',
        items: { $push: '$$ROOT' }
      }
    },
    // Limiter chaque catégorie selon POPULAR_DISTRIBUTION
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
    // Dérouler les items
    {
      $unwind: '$items'
    },
    // Remplacer la racine par l'item
    {
      $replaceRoot: { newRoot: '$items' }
    },
    // Trier le résultat final par catégorie puis orderCount
    {
      $sort: { category: 1, orderCount: -1 }
    }
  ];

  return MenuItem.aggregate(pipeline);
};

module.exports = {
  POPULAR_DISTRIBUTION,
  getPopularItems,
  getPopularItemsAggregated
};
