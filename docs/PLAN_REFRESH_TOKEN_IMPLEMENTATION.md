# Plan d'implémentation : Access Token + Refresh Token

> **Issue #9** : JWT Token Not Validated for Expiration Properly
> **Solution choisie** : Option A - Short-lived Access Token + Long-lived Refresh Token
> **Date** : Décembre 2025

---

## Contexte

### Problème actuel

```
1. User se connecte → reçoit JWT valide 30 jours
2. User se déconnecte → cookie supprimé côté client
3. MAIS le JWT reste valide côté serveur
4. Si un attaquant a volé le token → accès pendant 30 jours
```

### Solution

```
┌─────────────────────────────────────────────────────────────┐
│  Access Token (15 min)     │  Refresh Token (7 jours)       │
├─────────────────────────────────────────────────────────────┤
│  - Utilisé pour chaque     │  - Utilisé uniquement pour     │
│    requête API             │    obtenir un nouvel access    │
│  - Stocké en mémoire JS    │  - Stocké en cookie HttpOnly   │
│  - Courte durée = peu de   │  - Stocké en DB = révocable    │
│    risque si volé          │    immédiatement               │
└─────────────────────────────────────────────────────────────┘
```

---

## Plan d'exécution

### Step 1 : Créer le modèle RefreshToken

**Statut** : ⬜ À faire

**Fichier** : `models/RefreshToken.js`

**Schéma** :
```javascript
{
  token: String,           // Token aléatoire 64 bytes
  userId: ObjectId,        // Référence vers User
  expiresAt: Date,         // Expiration (7 jours)
  userAgent: String,       // Browser/device info
  ip: String,              // IP de création
  createdAt: Date          // Date de création
}
```

**Index** :
- `{ token: 1 }` - unique, pour recherche rapide
- `{ userId: 1 }` - pour logout all
- `{ expiresAt: 1 }` - TTL index, MongoDB supprime auto les expirés

**Impact** :
- ✅ Aucun impact sur le code existant
- ✅ Nouvelle collection `refreshtokens` créée automatiquement

**Validation** :
- [ ] Le modèle est créé sans erreur
- [ ] Les index sont correctement définis

---

### Step 2 : Créer tokenUtils.js

**Statut** : ⬜ À faire

**Fichier** : `utils/tokenUtils.js`

**Fonctions** :

| Fonction | Description | Paramètres | Retour |
|----------|-------------|------------|--------|
| `generateAccessToken` | Crée JWT 15 min | `userId` | `string` (JWT) |
| `generateRefreshToken` | Crée token aléatoire, stocke en DB | `userId, req` | `string` (token) |
| `verifyRefreshToken` | Vérifie token en DB | `token` | `RefreshToken \| null` |
| `revokeRefreshToken` | Supprime un token | `token` | `void` |
| `revokeAllUserTokens` | Supprime tous les tokens d'un user | `userId` | `void` |

**Configuration** :
```javascript
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 7;
```

**Impact** :
- ✅ Aucun impact sur le code existant
- ✅ Prépare les outils pour les étapes suivantes

**Validation** :
- [ ] Toutes les fonctions sont exportées
- [ ] Les tests unitaires passent (si créés)

---

### Step 3 : Ajouter les variables d'environnement

**Statut** : ⬜ À faire

**Fichier** : `.env.example`

**Variables à ajouter** :
```bash
# Token Configuration (Issue #9 - Refresh Token System)
ACCESS_TOKEN_EXPIRE=15m
REFRESH_TOKEN_EXPIRE_DAYS=7
```

**Valeurs par défaut** (si non définies) :
- `ACCESS_TOKEN_EXPIRE` : `15m`
- `REFRESH_TOKEN_EXPIRE_DAYS` : `7`

**Impact** :
- ✅ Aucun impact si variables non définies
- ✅ Valeurs par défaut sécurisées

**Validation** :
- [ ] `.env.example` mis à jour
- [ ] Documentation des variables

---

### Step 4 : Modifier le login controller

**Statut** : ⬜ À faire

**Fichier** : `controllers/authController.js`

**⚠️ BREAKING CHANGE**

**Avant** :
```javascript
// Login response
sendTokenResponse(user, 200, res, 'Login successful');

// Résultat:
// Cookie: token=<jwt_30_jours>
// Body: { success: true, message: '...', user: {...} }
```

**Après** :
```javascript
// Générer les tokens
const accessToken = generateAccessToken(user._id);
const refreshToken = await generateRefreshToken(user._id, req);

// Refresh token en cookie HttpOnly sécurisé
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  path: '/api/auth', // Limite l'envoi aux routes auth
});

// Access token dans le body
res.status(200).json({
  success: true,
  message: 'Login successful',
  accessToken,  // ← NOUVEAU
  user,
});
```

**Impact Frontend** :
- ⚠️ Stocker `response.data.accessToken` en mémoire (PAS localStorage)
- ⚠️ Envoyer `Authorization: Bearer <accessToken>` sur chaque requête
- ⚠️ Le cookie `token` n'existe plus

**Validation** :
- [ ] Login retourne `accessToken` dans le body
- [ ] Cookie `refreshToken` est HttpOnly
- [ ] Tests existants mis à jour

---

### Step 5 : Créer l'endpoint refresh

**Statut** : ⬜ À faire

**Route** : `POST /api/auth/refresh`

**Fichiers** :
- `controllers/authController.js` - nouvelle fonction `refreshToken`
- `routes/auth.js` - nouvelle route

**Logique** :
```javascript
const refreshTokenHandler = asyncHandler(async (req, res) => {
  // 1. Lire le refresh token du cookie
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'No refresh token provided',
      code: 'AUTH_NO_REFRESH_TOKEN'
    });
  }

  // 2. Vérifier en base de données
  const storedToken = await verifyRefreshToken(refreshToken);

  if (!storedToken) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
      code: 'AUTH_INVALID_REFRESH_TOKEN'
    });
  }

  // 3. Générer nouveau access token
  const accessToken = generateAccessToken(storedToken.userId);

  // 4. Retourner le nouveau token
  res.status(200).json({
    success: true,
    accessToken
  });
});
```

**Route** (publique, pas de middleware `protect`) :
```javascript
router.post('/refresh', refreshTokenHandler);
```

**Impact** :
- ✅ Nouvelle route, pas de breaking change

**Validation** :
- [ ] Refresh avec token valide → 200 + nouveau accessToken
- [ ] Refresh sans token → 401
- [ ] Refresh avec token invalide → 401
- [ ] Refresh avec token expiré → 401

---

### Step 6 : Modifier logout

**Statut** : ⬜ À faire

**Fichier** : `controllers/authController.js`

**⚠️ COMPORTEMENT MODIFIÉ**

**Avant** :
```javascript
const logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res); // Supprime cookie côté client
  // MAIS le JWT reste valide !
});
```

**Après** :
```javascript
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    // Révoquer en DB → invalide immédiatement
    await revokeRefreshToken(refreshToken);
  }

  // Supprimer les cookies
  res.clearCookie('refreshToken', { path: '/api/auth' });
  clearTokenCookie(res); // Ancien cookie pour rétrocompatibilité

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});
```

**Impact** :
- ✅ Logout devient **vraiment effectif**
- ✅ L'access token expire dans 15 min max (acceptable)

**Validation** :
- [ ] Après logout, refresh échoue avec 401
- [ ] L'ancien access token fonctionne encore (max 15 min)

---

### Step 7 : Ajouter logoutAll

**Statut** : ⬜ À faire

**Route** : `POST /api/auth/logout-all`

**Logique** :
```javascript
const logoutAll = asyncHandler(async (req, res) => {
  // Révoquer TOUS les refresh tokens de l'utilisateur
  await revokeAllUserTokens(req.user._id);

  // Supprimer le cookie actuel
  res.clearCookie('refreshToken', { path: '/api/auth' });

  res.status(200).json({
    success: true,
    message: 'Logged out from all devices'
  });
});
```

**Route** (protégée) :
```javascript
router.post('/logout-all', protect, logoutAll);
```

**Impact** :
- ✅ Nouvelle fonctionnalité
- ✅ Permet de déconnecter tous les appareils (ex: après vol de compte)

**Validation** :
- [ ] Après logout-all, aucun refresh token ne fonctionne
- [ ] L'utilisateur doit se reconnecter sur tous ses appareils

---

### Step 8 : Mettre à jour le middleware auth

**Statut** : ⬜ À faire

**Fichier** : `middleware/auth.js`

**⚠️ BREAKING CHANGE**

**Modifications** :
1. Accepter uniquement `Authorization: Bearer <accessToken>`
2. Ne plus accepter le cookie `token` (ancien système)
3. Retourner code spécifique si token expiré

**Avant** :
```javascript
if (req.cookies.token) {
  token = req.cookies.token;
} else if (req.headers.authorization?.startsWith('Bearer')) {
  token = req.headers.authorization.split(' ')[1];
}
```

**Après** :
```javascript
// Uniquement Authorization header
if (req.headers.authorization?.startsWith('Bearer')) {
  token = req.headers.authorization.split(' ')[1];
}

// Vérification avec gestion expiration
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
} catch (error) {
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Access token expired',
      code: 'AUTH_TOKEN_EXPIRED'  // ← Frontend doit refresh
    });
  }
  return res.status(401).json({
    success: false,
    error: 'Invalid token',
    code: 'AUTH_INVALID_TOKEN'
  });
}
```

**Nouveaux codes d'erreur** :
| Code | Signification | Action Frontend |
|------|---------------|-----------------|
| `AUTH_TOKEN_EXPIRED` | Access token expiré | Appeler `/api/auth/refresh` |
| `AUTH_INVALID_TOKEN` | Token invalide/malformé | Rediriger vers login |
| `AUTH_NO_REFRESH_TOKEN` | Pas de refresh token | Rediriger vers login |
| `AUTH_INVALID_REFRESH_TOKEN` | Refresh token révoqué/expiré | Rediriger vers login |

**Impact Frontend** :
- ⚠️ Intercepter `AUTH_TOKEN_EXPIRED` pour refresh automatique
- ⚠️ Ne plus envoyer le cookie `token`

**Validation** :
- [ ] Requête sans token → 401
- [ ] Requête avec token expiré → 401 `AUTH_TOKEN_EXPIRED`
- [ ] Requête avec token valide → 200
- [ ] Tous les tests existants passent

---

### Step 9 : Écrire les tests d'intégration

**Statut** : ⬜ À faire

**Fichier** : `tests/integration/refreshToken.test.js`

**Tests à écrire** :

```javascript
describe('Refresh Token System', () => {
  describe('POST /api/auth/login', () => {
    it('should return accessToken in body');
    it('should set refreshToken cookie');
    it('should store refresh token in database');
  });

  describe('Protected routes with access token', () => {
    it('should accept valid access token');
    it('should reject expired access token with AUTH_TOKEN_EXPIRED');
    it('should reject invalid access token');
  });

  describe('POST /api/auth/refresh', () => {
    it('should return new access token with valid refresh token');
    it('should reject without refresh token cookie');
    it('should reject with invalid refresh token');
    it('should reject with expired refresh token');
    it('should reject with revoked refresh token');
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke refresh token in database');
    it('should clear refreshToken cookie');
    it('should reject refresh after logout');
  });

  describe('POST /api/auth/logout-all', () => {
    it('should revoke all user refresh tokens');
    it('should reject refresh from all devices after logout-all');
  });
});
```

**Validation** :
- [ ] Tous les nouveaux tests passent
- [ ] Tous les tests existants passent (avec modifications)

---

### Step 10 : Documentation frontend

**Statut** : ⬜ À faire

**Fichier** : `docs/FRONTEND_REFRESH_TOKEN.md`

**Contenu** :
1. Nouveau flow d'authentification (diagramme)
2. Changements dans les réponses API
3. Implémentation de l'intercepteur Axios
4. Gestion du refresh automatique
5. Stockage sécurisé du access token
6. Guide de migration depuis l'ancien système
7. Gestion des erreurs (codes)

---

## Résumé des impacts

### Fichiers créés
| Fichier | Description |
|---------|-------------|
| `models/RefreshToken.js` | Schéma MongoDB pour refresh tokens |
| `utils/tokenUtils.js` | Utilitaires génération/révocation tokens |
| `tests/integration/refreshToken.test.js` | Tests du nouveau système |
| `docs/FRONTEND_REFRESH_TOKEN.md` | Guide d'intégration frontend |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `controllers/authController.js` | Login, logout, refresh, logoutAll |
| `middleware/auth.js` | Gestion access token uniquement |
| `routes/auth.js` | Nouvelles routes refresh, logout-all |
| `constants/errorCodes.js` | Nouveaux codes d'erreur |
| `.env.example` | Nouvelles variables |

### Breaking Changes (Frontend)
| Changement | Avant | Après |
|------------|-------|-------|
| Token location | Cookie `token` | Header `Authorization: Bearer` |
| Login response | `{ success, user }` | `{ success, user, accessToken }` |
| Token storage | Automatique (cookie) | Manuel (mémoire JS) |
| Token expiration | 30 jours | 15 minutes |
| Refresh needed | Non | Oui, toutes les 15 min |

---

## Checklist globale

- [ ] **Step 1** : Modèle RefreshToken créé
- [ ] **Step 2** : tokenUtils.js créé
- [ ] **Step 3** : Variables d'environnement ajoutées
- [ ] **Step 4** : Login modifié (⚠️ breaking)
- [ ] **Step 5** : Endpoint refresh créé
- [ ] **Step 6** : Logout modifié
- [ ] **Step 7** : Endpoint logout-all créé
- [ ] **Step 8** : Middleware auth mis à jour (⚠️ breaking)
- [ ] **Step 9** : Tests écrits et passent
- [ ] **Step 10** : Documentation frontend créée
- [ ] **Final** : Tous les 408+ tests passent
- [ ] **Final** : Commit et push

---

## Notes importantes

### Rétrocompatibilité temporaire

Pendant la transition, on peut garder le support du cookie `token` :

```javascript
// middleware/auth.js - Mode transition
if (req.headers.authorization?.startsWith('Bearer')) {
  token = req.headers.authorization.split(' ')[1];
} else if (req.cookies.token) {
  // DEPRECATED - Support temporaire pour migration
  console.warn('Using deprecated cookie auth - please update to Bearer token');
  token = req.cookies.token;
}
```

### Ordre d'exécution recommandé

1. Steps 1-3 : Préparation (aucun impact)
2. Step 5 : Créer refresh (nouvelle fonctionnalité)
3. Step 7 : Créer logout-all (nouvelle fonctionnalité)
4. Steps 4, 6, 8 : Breaking changes (coordonner avec frontend)
5. Step 9 : Tests
6. Step 10 : Documentation

### Rollback possible

Si problème, revenir à l'ancien système est simple :
- Supprimer les nouvelles routes
- Restaurer l'ancien middleware
- Les refresh tokens en DB seront ignorés (TTL les supprimera)
