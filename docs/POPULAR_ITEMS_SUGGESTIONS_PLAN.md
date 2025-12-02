# Plan d'implémentation : Popular Items Override & Restaurant Suggestions

## Contexte et inspiration

D'après les recherches :
- **Shopify** utilise un système de tri manuel avec override par collection, l'admin peut manuellement réordonner ou exclure des produits
- **WooCommerce** utilise une taxonomie `product_visibility` avec un terme `featured` pour marquer les produits mis en avant
- **Best practices REST API 2024** : utiliser `PATCH` pour les toggles partiels, séparer les routes admin des routes publiques

## Règles métier

### Popular Items
- Distribution automatique par catégorie : **2 appetizers, 3 mains, 1 dessert, 2 beverages** (total: 8 items)
- Sélection basée sur `orderCount` (les plus commandés)
- `isPopularOverride: false` (défaut) → l'item participe à la sélection automatique
- `isPopularOverride: true` → l'item est **exclu** de la sélection automatique
- Quand un item est exclu, le suivant par orderCount dans sa catégorie prend sa place

### Restaurant Suggestions
- Choix libre de l'admin via `isSuggested: Boolean`
- Indépendant du système de popularité
- Pas de limite de nombre

---

## Phase 1 : Modification du Modèle MenuItem

**Fichier** : `models/MenuItem.js`

**Ajouts** :
```javascript
isPopularOverride: {
  type: Boolean,
  default: false,  // false = participe au calcul auto, true = exclu
},
isSuggested: {
  type: Boolean,
  default: false,  // true = suggestion du restaurant
}
```

**Index à ajouter** :
```javascript
MenuItemSchema.index({ category: 1, isPopularOverride: 1, orderCount: -1 });
MenuItemSchema.index({ isSuggested: 1 });
```

---

## Phase 2 : Helper pour la sélection des Popular Items

**Nouveau fichier** : `utils/popularItemsHelper.js`

**Logique** :
```javascript
const POPULAR_DISTRIBUTION = {
  appetizer: 2,
  main: 3,
  dessert: 1,
  beverage: 2
};

async function getPopularItems() {
  // Pour chaque catégorie, récupérer les top N par orderCount
  // où isPopularOverride === false ET isAvailable === true
}
```

**Avantages** :
- Logique centralisée et testable
- Facile à modifier si les quotas changent
- Réutilisable (API publique + panel admin)

---

## Phase 3 : Routes et Controller Admin

**Fichier** : `controllers/adminController.js`

**Nouvelles fonctions** :

| Fonction | Description |
|----------|-------------|
| `togglePopularOverride` | Toggle `isPopularOverride` (true ↔ false) |
| `resetAllPopularOverrides` | Remet tous les overrides à false |
| `toggleSuggested` | Toggle `isSuggested` (true ↔ false) |
| `getSuggestedItems` | Liste des items suggérés (pour admin) |

**Fichier** : `routes/admin.js`

**Nouvelles routes** :
```
PATCH /api/admin/menu/:id/popular      → togglePopularOverride
PATCH /api/admin/menu/popular/reset    → resetAllPopularOverrides
PATCH /api/admin/menu/:id/suggested    → toggleSuggested
GET   /api/admin/menu/suggested        → getSuggestedItems (admin view)
```

---

## Phase 4 : Route Publique pour Suggestions

**Fichier** : `controllers/menuController.js`

**Nouvelle fonction** :
```javascript
const getSuggestedItems = asyncHandler(async (req, res) => {
  const items = await MenuItem.find({
    isSuggested: true,
    isAvailable: true
  });
  // ...
});
```

**Fichier** : `routes/menu.js`

**Nouvelle route** :
```
GET /api/menu/suggestions → getSuggestedItems (public)
```

---

## Phase 5 : Modification de getPopularItems

**Fichier** : `controllers/menuController.js`

**Avant** :
```javascript
const popularItems = await MenuItem.find({ isAvailable: true })
  .sort({ orderCount: -1 })
  .limit(limit);
```

**Après** :
```javascript
const { getPopularItems } = require('../utils/popularItemsHelper');

const getPopularItemsController = asyncHandler(async (req, res) => {
  const popularItems = await getPopularItems();
  // Retourne 8 items : 2 appetizers, 3 mains, 1 dessert, 2 beverages
});
```

---

## Phase 6 : Migration / Seed Update

**Fichier** : `seed-menu.js`

- Ajouter `isPopularOverride: false` et `isSuggested: false` aux items existants
- Optionnel : marquer quelques items comme `isSuggested: true` pour le test

---

## Phase 7 : Tests

**Fichiers** :
- `tests/controllers/adminController.test.js` (nouveau ou mise à jour)
- `tests/controllers/menuController.test.js` (mise à jour)
- `tests/utils/popularItemsHelper.test.js` (nouveau)

**Cas de test** :
1. Popular items respecte la distribution par catégorie
2. Un item avec `isPopularOverride: true` est exclu
3. Reset remet tous les overrides à false
4. Toggle suggested fonctionne
5. Route publique suggestions retourne les bons items

---

## Résumé des fichiers à modifier/créer

| Action | Fichier |
|--------|---------|
| Modifier | `models/MenuItem.js` |
| Créer | `utils/popularItemsHelper.js` |
| Modifier | `controllers/adminController.js` |
| Modifier | `controllers/menuController.js` |
| Modifier | `routes/admin.js` |
| Modifier | `routes/menu.js` |
| Modifier | `seed-menu.js` |
| Créer/Modifier | Tests associés |

---

## Ordre d'implémentation recommandé

1. **MenuItem.js** - Ajouter les champs
2. **popularItemsHelper.js** - Créer le helper
3. **menuController.js** - Modifier `getPopularItems` + ajouter `getSuggestedItems`
4. **adminController.js** - Ajouter les fonctions admin
5. **routes** - Ajouter les nouvelles routes
6. **seed-menu.js** - Mettre à jour
7. **Tests** - Valider le tout

---

## Sources

- [Shopify Help Center - Collection layout](https://help.shopify.com/en/manual/products/collections/collection-layout)
- [WooCommerce Product Data Schema](https://github.com/woocommerce/woocommerce/wiki/Product-Data-Schema)
- [Stack Overflow - REST API Best Practices](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
- [Microsoft Azure - Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
