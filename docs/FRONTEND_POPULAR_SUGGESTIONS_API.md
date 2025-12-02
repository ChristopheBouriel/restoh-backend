# API Documentation: Popular Items & Restaurant Suggestions

## Vue d'ensemble

Cette documentation décrit les nouvelles fonctionnalités backend pour :
1. **Popular Items** : Sélection automatique des plats populaires par catégorie avec possibilité d'exclusion admin
2. **Restaurant Suggestions** : Suggestions manuelles du restaurant (choix libre de l'admin)

---

## Table des matières

1. [Concepts clés](#concepts-clés)
2. [Nouveaux champs MenuItem](#nouveaux-champs-menuitem)
3. [Routes publiques](#routes-publiques)
4. [Routes admin](#routes-admin)
5. [Exemples de réponses JSON](#exemples-de-réponses-json)
6. [Cas d'utilisation frontend](#cas-dutilisation-frontend)
7. [Gestion des erreurs](#gestion-des-erreurs)

---

## Concepts clés

### Popular Items (Plats populaires)

**Logique automatique** : Les plats populaires sont sélectionnés automatiquement en fonction du nombre de commandes (`orderCount`).

**Distribution fixe par catégorie** :
| Catégorie   | Nombre d'items |
|-------------|----------------|
| appetizer   | 2              |
| main        | 3              |
| dessert     | 1              |
| beverage    | 2              |
| **Total**   | **8 items**    |

**Critères de sélection** :
- `isAvailable: true` (le plat doit être disponible)
- `isPopularOverride: false` (le plat n'est pas exclu par l'admin)
- Trié par `orderCount` décroissant (les plus commandés en premier)

**Override admin** :
- L'admin peut **exclure** un plat des populaires en passant `isPopularOverride` à `true`
- Quand un plat est exclu, le suivant par `orderCount` dans sa catégorie prend automatiquement sa place
- L'admin peut réintégrer un plat en repassant `isPopularOverride` à `false`

### Restaurant Suggestions (Suggestions du restaurant)

**Logique manuelle** : L'admin choisit librement quels plats mettre en avant.

- Indépendant du système de popularité
- Pas de limite de nombre
- Un plat peut être à la fois populaire ET suggéré

---

## Nouveaux champs MenuItem

```typescript
interface MenuItem {
  // ... champs existants ...

  // NOUVEAU: Exclusion des populaires (défaut: false)
  isPopularOverride: boolean;
  // false = participe à la sélection automatique
  // true = exclu de la sélection automatique

  // NOUVEAU: Suggestion du restaurant (défaut: false)
  isSuggested: boolean;
  // false = pas une suggestion
  // true = suggestion du restaurant

  // Existant mais important pour la logique
  orderCount: number;      // Nombre de commandes (auto-incrémenté)
  isAvailable: boolean;    // Disponibilité du plat
  isPopular: boolean;      // (legacy, non utilisé dans la nouvelle logique)
}
```

---

## Routes publiques

### GET /api/menu/popular

**Description** : Récupère les 8 plats populaires selon la distribution par catégorie.

**Authentification** : Non requise

**Méthode** : `GET`

**URL** : `/api/menu/popular`

**Paramètres** : Aucun

**Réponse succès** (200) :
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "692e955551372310e9d69b45",
      "name": "Salade César",
      "description": "Salade romaine, croûtons...",
      "price": 12.5,
      "image": "salade-cesar.jpg",
      "category": "appetizer",
      "cuisine": "continental",
      "isVegetarian": true,
      "isAvailable": true,
      "isPopularOverride": false,
      "isSuggested": false,
      "orderCount": 32,
      "rating": {
        "average": 4.5,
        "count": 18
      },
      "ingredients": ["Salade romaine", "Croûtons", "Parmesan"],
      "allergens": ["wheat", "dairy", "eggs"],
      "preparationTime": 15,
      "reviews": [],
      "createdAt": "2025-12-02T07:29:25.191Z",
      "updatedAt": "2025-12-02T07:29:25.191Z"
    }
    // ... 7 autres items
  ]
}
```

**Distribution garantie dans la réponse** :
- 2 items avec `category: "appetizer"`
- 3 items avec `category: "main"`
- 1 item avec `category: "dessert"`
- 2 items avec `category: "beverage"`

**Note** : L'ordre des items dans le tableau n'est pas garanti par catégorie. Le frontend doit grouper/trier si nécessaire.

---

### GET /api/menu/suggestions

**Description** : Récupère tous les plats suggérés par le restaurant.

**Authentification** : Non requise

**Méthode** : `GET`

**URL** : `/api/menu/suggestions`

**Paramètres** : Aucun

**Réponse succès** (200) :
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "692e955551372310e9d69b50",
      "name": "Fondant au Chocolat",
      "description": "Gâteau au chocolat noir avec cœur coulant",
      "price": 8,
      "image": "fondant-chocolat.jpg",
      "category": "dessert",
      "cuisine": "continental",
      "isVegetarian": true,
      "isAvailable": true,
      "isPopularOverride": false,
      "isSuggested": true,
      "orderCount": 15,
      "rating": {
        "average": 4.8,
        "count": 10
      },
      "ingredients": ["Chocolat noir", "Beurre", "Œufs", "Farine"],
      "allergens": ["dairy", "eggs", "wheat"],
      "preparationTime": 15,
      "reviews": [],
      "createdAt": "2025-12-02T07:29:25.192Z",
      "updatedAt": "2025-12-02T07:29:25.192Z"
    }
    // ... autres suggestions
  ]
}
```

**Caractéristiques** :
- Seuls les items avec `isSuggested: true` ET `isAvailable: true` sont retournés
- Triés par `createdAt` décroissant (plus récents en premier)
- Pas de limite de nombre

---

## Routes admin

> **Toutes les routes admin nécessitent** :
> - Authentification (cookie `token` JWT)
> - Rôle `admin`

### PATCH /api/admin/menu/:id/popular

**Description** : Toggle l'exclusion d'un plat des populaires.

**Authentification** : Requise (admin)

**Méthode** : `PATCH`

**URL** : `/api/admin/menu/:id/popular`

**Paramètres URL** :
| Paramètre | Type   | Description        |
|-----------|--------|--------------------|
| id        | string | ID du menu item    |

**Body** : Aucun (toggle automatique)

**Comportement** :
- Si `isPopularOverride` est `false` → passe à `true` (exclut le plat)
- Si `isPopularOverride` est `true` → passe à `false` (réintègre le plat)

**Réponse succès** (200) - Exclusion :
```json
{
  "success": true,
  "message": "Menu item excluded from popular items",
  "data": {
    "id": "692e955551372310e9d69b45",
    "name": "Salade César",
    "isPopularOverride": true
  }
}
```

**Réponse succès** (200) - Réintégration :
```json
{
  "success": true,
  "message": "Menu item included in popular items selection",
  "data": {
    "id": "692e955551372310e9d69b45",
    "name": "Salade César",
    "isPopularOverride": false
  }
}
```

**Réponse erreur** (404) :
```json
{
  "success": false,
  "error": "Menu item not found with id 507f1f77bcf86cd799439011",
  "code": "MENU_ITEM_NOT_FOUND",
  "details": {
    "menuItemId": "507f1f77bcf86cd799439011"
  }
}
```

---

### PATCH /api/admin/menu/popular/reset

**Description** : Réinitialise tous les overrides à `false` (tous les plats participent à nouveau à la sélection automatique).

**Authentification** : Requise (admin)

**Méthode** : `PATCH`

**URL** : `/api/admin/menu/popular/reset`

**Body** : Aucun

**Réponse succès** (200) :
```json
{
  "success": true,
  "message": "All popular overrides have been reset",
  "data": {
    "modifiedCount": 2
  }
}
```

**Note** : `modifiedCount` indique le nombre d'items qui avaient `isPopularOverride: true` et ont été remis à `false`.

---

### GET /api/admin/menu/popular

**Description** : Récupère le status des overrides (vue admin).

**Authentification** : Requise (admin)

**Méthode** : `GET`

**URL** : `/api/admin/menu/popular`

**Réponse succès** (200) :
```json
{
  "success": true,
  "data": {
    "overriddenItems": [
      {
        "id": "692e955551372310e9d69b45",
        "name": "Salade César",
        "category": "appetizer",
        "orderCount": 32,
        "isPopularOverride": true,
        "isAvailable": true
      }
    ],
    "overridesByCategory": [
      { "_id": "appetizer", "count": 1 }
    ],
    "totalOverridden": 1
  }
}
```

**Champs retournés** :
- `overriddenItems` : Liste des items actuellement exclus
- `overridesByCategory` : Comptage des exclusions par catégorie
- `totalOverridden` : Nombre total d'items exclus

---

### PATCH /api/admin/menu/:id/suggested

**Description** : Toggle le statut suggestion d'un plat.

**Authentification** : Requise (admin)

**Méthode** : `PATCH`

**URL** : `/api/admin/menu/:id/suggested`

**Paramètres URL** :
| Paramètre | Type   | Description        |
|-----------|--------|--------------------|
| id        | string | ID du menu item    |

**Body** : Aucun (toggle automatique)

**Comportement** :
- Si `isSuggested` est `false` → passe à `true` (ajoute aux suggestions)
- Si `isSuggested` est `true` → passe à `false` (retire des suggestions)

**Réponse succès** (200) - Ajout :
```json
{
  "success": true,
  "message": "Menu item added to restaurant suggestions",
  "data": {
    "id": "692e955551372310e9d69b49",
    "name": "Burger Gourmand",
    "isSuggested": true
  }
}
```

**Réponse succès** (200) - Retrait :
```json
{
  "success": true,
  "message": "Menu item removed from restaurant suggestions",
  "data": {
    "id": "692e955551372310e9d69b49",
    "name": "Burger Gourmand",
    "isSuggested": false
  }
}
```

---

### GET /api/admin/menu/suggested

**Description** : Récupère tous les plats suggérés (vue admin, inclut les indisponibles).

**Authentification** : Requise (admin)

**Méthode** : `GET`

**URL** : `/api/admin/menu/suggested`

**Réponse succès** (200) :
```json
{
  "success": true,
  "count": 4,
  "data": [
    // Tous les items avec isSuggested: true
    // Y COMPRIS ceux avec isAvailable: false
  ]
}
```

**Différence avec `/api/menu/suggestions`** :
| Aspect              | Route publique                  | Route admin                     |
|---------------------|--------------------------------|---------------------------------|
| URL                 | `/api/menu/suggestions`        | `/api/admin/menu/suggested`     |
| Auth                | Non                            | Oui (admin)                     |
| Items indisponibles | Exclus                         | Inclus                          |

---

## Exemples de réponses JSON

### MenuItem complet (structure de référence)

```json
{
  "id": "692e955551372310e9d69b45",
  "name": "Salade César",
  "description": "Salade romaine, croûtons croustillants, copeaux de parmesan, sauce césar maison",
  "price": 12.5,
  "image": "salade-cesar.jpg",
  "cloudinaryPublicId": null,
  "category": "appetizer",
  "cuisine": "continental",
  "isVegetarian": true,
  "isAvailable": true,
  "ingredients": ["Salade romaine", "Croûtons", "Parmesan", "Sauce césar"],
  "allergens": ["wheat", "dairy", "eggs"],
  "preparationTime": 15,
  "rating": {
    "average": 4.5,
    "count": 18
  },
  "reviews": [],
  "isPopular": false,
  "isPopularOverride": false,
  "isSuggested": false,
  "orderCount": 32,
  "createdAt": "2025-12-02T07:29:25.191Z",
  "updatedAt": "2025-12-02T07:29:25.191Z"
}
```

---

## Cas d'utilisation frontend

### 1. Page d'accueil - Afficher les plats populaires

```typescript
// Service
async function getPopularItems(): Promise<MenuItem[]> {
  const response = await fetch('/api/menu/popular');
  const data = await response.json();
  return data.data;
}

// Composant
const popularItems = await getPopularItems();
// Grouper par catégorie si nécessaire
const grouped = {
  appetizer: popularItems.filter(item => item.category === 'appetizer'),
  main: popularItems.filter(item => item.category === 'main'),
  dessert: popularItems.filter(item => item.category === 'dessert'),
  beverage: popularItems.filter(item => item.category === 'beverage'),
};
```

### 2. Page d'accueil - Afficher les suggestions du restaurant

```typescript
async function getSuggestedItems(): Promise<MenuItem[]> {
  const response = await fetch('/api/menu/suggestions');
  const data = await response.json();
  return data.data;
}
```

### 3. Panel Admin - Exclure un plat des populaires

```typescript
async function togglePopularOverride(itemId: string): Promise<void> {
  const response = await fetch(`/api/admin/menu/${itemId}/popular`, {
    method: 'PATCH',
    credentials: 'include', // Important pour le cookie
  });
  const data = await response.json();

  if (data.success) {
    // Mettre à jour l'UI
    // data.data.isPopularOverride contient la nouvelle valeur
    console.log(data.message);
  }
}
```

### 4. Panel Admin - Reset tous les overrides

```typescript
async function resetAllPopularOverrides(): Promise<number> {
  const response = await fetch('/api/admin/menu/popular/reset', {
    method: 'PATCH',
    credentials: 'include',
  });
  const data = await response.json();
  return data.data.modifiedCount;
}
```

### 5. Panel Admin - Ajouter/Retirer une suggestion

```typescript
async function toggleSuggested(itemId: string): Promise<void> {
  const response = await fetch(`/api/admin/menu/${itemId}/suggested`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const data = await response.json();

  if (data.success) {
    console.log(data.message);
    // data.data.isSuggested contient la nouvelle valeur
  }
}
```

### 6. Panel Admin - Liste des items avec leur statut

```typescript
// Récupérer tous les items du menu
const allItems = await fetch('/api/menu').then(r => r.json());

// Pour chaque item, afficher :
// - isPopularOverride: true = "Exclu des populaires"
// - isSuggested: true = "Suggestion du restaurant"

// Interface suggérée pour l'admin
interface AdminMenuItem extends MenuItem {
  // Indicateurs visuels
  isExcludedFromPopular: boolean; // = isPopularOverride
  isRestaurantSuggestion: boolean; // = isSuggested
}
```

---

## Gestion des erreurs

### Codes d'erreur

| Code HTTP | Code erreur           | Description                          |
|-----------|-----------------------|--------------------------------------|
| 401       | UNAUTHORIZED          | Non authentifié                      |
| 403       | FORBIDDEN             | Pas le rôle admin                    |
| 404       | MENU_ITEM_NOT_FOUND   | Item non trouvé                      |

### Structure d'erreur standard

```json
{
  "success": false,
  "error": "Message d'erreur lisible",
  "code": "CODE_ERREUR",
  "details": {
    // Informations supplémentaires
  }
}
```

---

## Résumé des endpoints

### Routes publiques (pas d'auth)

| Méthode | URL                    | Description                           |
|---------|------------------------|---------------------------------------|
| GET     | /api/menu/popular      | Plats populaires (8 items par catégorie) |
| GET     | /api/menu/suggestions  | Suggestions du restaurant             |

### Routes admin (auth + role admin)

| Méthode | URL                           | Description                          |
|---------|-------------------------------|--------------------------------------|
| GET     | /api/admin/menu/popular       | Status des overrides                 |
| PATCH   | /api/admin/menu/:id/popular   | Toggle exclusion d'un plat           |
| PATCH   | /api/admin/menu/popular/reset | Reset tous les overrides             |
| GET     | /api/admin/menu/suggested     | Liste des suggestions (admin)        |
| PATCH   | /api/admin/menu/:id/suggested | Toggle suggestion d'un plat          |

---

## Notes importantes pour le frontend

1. **Les routes admin utilisent PATCH** (pas PUT) car elles modifient partiellement la ressource

2. **Le toggle est automatique** : pas besoin d'envoyer un body avec la nouvelle valeur

3. **Distinction public/admin pour les suggestions** :
   - `/api/menu/suggestions` → exclut les items indisponibles
   - `/api/admin/menu/suggested` → inclut tous les items suggérés

4. **L'ordre des populaires n'est pas garanti** : le frontend doit grouper/trier par catégorie si nécessaire

5. **Un item peut être populaire ET suggéré** : les deux systèmes sont indépendants

6. **Le champ `isPopular` (legacy) n'est plus utilisé** : utiliser `isPopularOverride` pour la nouvelle logique
