# Récapitulatif des Sessions - 28 Janvier au 2 Février 2026

**Document de contexte** pour reprendre le travail après perte de contexte.

---

## Résumé Exécutif

Sessions principalement consacrées à :
1. **Safari/iOS ITP** - Cookies bloqués cross-origin → fallback localStorage
2. **Menu Mobile** - État d'auth et panier non fonctionnels
3. **Corrections diverses** - Messages contact, suppression compte, réservations

---

## Environnement de Déploiement

| Composant | Plateforme | URL | Branche |
|-----------|------------|-----|---------|
| Backend | Render | https://restoh-backend.onrender.com | `fix/safari-itp-localstorage-fallback` |
| Frontend | Cloudflare Pages | (voir Cloudflare Dashboard) | `deploy/cloudflare` |
| Variable Cloudflare | - | `VITE_API_URL=https://restoh-backend.onrender.com/api` | - |

---

## 1. Problème Safari/iOS ITP (28 Janvier)

### Contexte
Après login sur Safari/iOS, l'utilisateur n'apparaissait pas connecté dans l'UI malgré le toast "successfully logged".

### Cause Racine
Safari ITP (Intelligent Tracking Prevention) bloque les cookies cross-origin, même avec `sameSite: 'none'` et `secure: true`.

### Solution Implémentée

#### Backend (restOh-back)

**server.js** - Trust Proxy pour Render :
```javascript
// Ligne ~15, après les imports
app.set('trust proxy', 1);
```

**utils/authCookies.js** et **utils/tokenUtils.js** - sameSite=none en prod :
```javascript
const getRefreshTokenCookieOptions = (rememberMe) => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',  // 'none' pour cross-origin
    maxAge,
    path: '/api/auth',
  };
};
```

**controllers/authController.js** - Refresh token dans le body :
```javascript
// Dans login() - retourner aussi le refreshToken dans le body
res.status(200).json({
  success: true,
  accessToken,
  refreshToken,  // AJOUTÉ pour Safari fallback
  user: { ... }
});

// Dans refreshTokenHandler() - accepter token depuis body
const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

// Dans logout() - accepter token depuis body
const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
```

#### Frontend (restoh-frontend) - Branche deploy/cloudflare

**NOUVEAU FICHIER** `src/utils/tokenStorage.js` :
```javascript
const REFRESH_TOKEN_KEY = 'rt_fallback'

export const isSafariOrIOS = () => {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  return isIOS || isSafari
}

export const needsLocalStorageFallback = () => isSafariOrIOS()
export const storeRefreshToken = (token) => localStorage.setItem(REFRESH_TOKEN_KEY, token)
export const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY)
export const clearStoredRefreshToken = () => localStorage.removeItem(REFRESH_TOKEN_KEY)
```

**src/store/authStore.js** - Stocker le token après login :
```javascript
// Dans login()
if (needsLocalStorageFallback() && result.refreshToken) {
  storeRefreshToken(result.refreshToken)
}
```

**src/api/authApi.js** - Envoyer le token dans le body :
```javascript
// Dans refreshToken()
const body = {}
if (needsLocalStorageFallback()) {
  const storedToken = getStoredRefreshToken()
  if (storedToken) body.refreshToken = storedToken
}
const response = await apiClient.post('/auth/refresh', body)

// Dans logout()
const body = {}
if (needsLocalStorageFallback()) {
  const storedToken = getStoredRefreshToken()
  if (storedToken) body.refreshToken = storedToken
}
await apiClient.post('/auth/logout', body)
clearStoredRefreshToken()
```

**src/api/apiClient.js** - Intercepteur de refresh :
```javascript
// Dans l'intercepteur 401
const body = {}
if (needsLocalStorageFallback()) {
  const storedToken = getStoredRefreshToken()
  if (storedToken) body.refreshToken = storedToken
}
const response = await axios.post(`${baseURL}/auth/refresh`, body, { withCredentials: true })
```

---

## 2. React Context Wrapper pour Zustand (28 Janvier)

### Contexte
Même avec le localStorage fallback, l'UI ne se mettait pas à jour sur Safari après login.

### Cause
Bug connu avec Zustand + React 18 sur Safari : `useSyncExternalStore` ne déclenche pas toujours les re-renders.

### Solution

**NOUVEAU FICHIER** `src/contexts/AuthContext.jsx` :
- Crée un Context React qui wrappe le store Zustand
- Souscrit aux changements du store et met à jour un state React local
- Assure des re-renders fiables sur tous les navigateurs

**src/main.jsx** :
```jsx
import { AuthProvider } from './contexts/AuthContext'

<AuthProvider>
  <App />
</AuthProvider>
```

**src/hooks/useAuth.js** :
```javascript
import { useAuthContext } from '../contexts/AuthContext'

export const useAuth = () => {
  return useAuthContext()  // Au lieu de useAuthStore()
}
```

**Fichiers modifiés** pour utiliser `useAuthContext` au lieu de `useAuthStore` :
- `src/App.jsx`
- `src/components/layout/Header.jsx`
- `src/pages/auth/Register.jsx`
- `src/pages/menu/Menu.jsx`
- `src/pages/profile/Profile.jsx`
- `src/pages/reservations/Reservations.jsx`
- `src/pages/reviews/RestaurantReviews.jsx`

---

## 3. Menu Mobile - État Auth et Panier (28 Janvier)

### Problème
Le menu burger affichait toujours "Cart (0)" et "Login" en dur, même connecté.

### Solution

**src/components/layout/Header.jsx** - Section Mobile Navigation :
```jsx
<div className="border-t pt-2 mt-2">
  <button
    onClick={() => {
      setIsMenuOpen(false)
      setTimeout(() => toggleCart(), 100)  // Délai pour éviter conflit UI
    }}
    className="..."
  >
    <ShoppingCart /> Cart ({totalItemsAvailable})
  </button>

  {isAuthenticated ? (
    <>
      <Link to={ROUTES.PROFILE}>{user?.name || 'My Profile'}</Link>
      <Link to={ROUTES.ORDERS}>My Orders</Link>
      {user?.role !== 'admin' && <Link to={ROUTES.MY_MESSAGES}>My Messages</Link>}
      {user?.role === 'admin' && <Link to="/admin">Admin Panel</Link>}
      <button onClick={logout}>Logout</button>
    </>
  ) : (
    <Link to={ROUTES.LOGIN}>Login</Link>
  )}
</div>
```

---

## 4. Session Restore au Démarrage (28 Janvier)

### Problème
Après refresh de page sur Safari, l'utilisateur était déconnecté.

### Solution

**src/App.jsx** :
```javascript
useEffect(() => {
  // Toujours essayer de restaurer la session, même si déjà authentifié
  // (Supprimé le check `if (!isAuthenticated)`)
  initializeAuth()
}, [initializeAuth])
```

---

## 5. Cloudflare SPA Routing (28-29 Janvier)

### Problème
Les routes dynamiques (ex: `/menu/123`) retournaient 404 après refresh.

### Solution

**Fichier** `public/404.html` :
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RestOh!</title>
  <script>
    // Redirect to index.html with the full path preserved
    var path = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace('/' + '?redirect=' + encodeURIComponent(path));
  </script>
</head>
<body></body>
</html>
```

Note: `_redirects` et `_routes.json` ont été essayés mais ne fonctionnent pas sur Cloudflare Pages de la même manière que Netlify.

---

## 6. Corrections Messages Contact (2 Février - Aujourd'hui)

### Problème 1 : Ouverture du mauvais message
Quand un message avait un "New Reply" de l'admin, cliquer dessus ouvrait le premier message de la liste au lieu du bon.

### Cause
Le backend transformait `_id` en `id` pour le document principal mais PAS pour les sous-documents `discussion`.

### Solution Backend

**models/Contact.js** :
```javascript
toJSON: {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // AJOUTÉ: Transform discussion subdocuments
    if (ret.discussion && Array.isArray(ret.discussion)) {
      ret.discussion = ret.discussion.map(msg => {
        if (msg._id) {
          msg.id = msg._id;
          delete msg._id;
        }
        return msg;
      });
    }
    return ret;
  }
}
```

### Solution Frontend

**src/pages/contact/MyMessages.jsx** - Utiliser `id` au lieu de `_id` :
```javascript
// Ligne 34
const updatedMessage = myMessages.find(m => m.id === selectedMessage.id)

// Lignes 109-110
if (reply.id) {
  await markDiscussionMessageAsRead(message.id, reply.id)
}

// Ligne 137
const result = await addReply(selectedMessage.id, replyText)

// Ligne 311
<div key={message.id}>
```

### Tests mis à jour
**src/__tests__/pages/contact/MyMessages.test.jsx** - Mocks avec `id` au lieu de `_id`

---

## 7. Suppression de Compte - Conversations Fermées (2 Février)

### Problème
Quand un user supprimait son compte, l'email était anonymisé mais l'admin pouvait encore voir l'ancien email et essayer de répondre.

### Solution

**controllers/authController.js** :
```javascript
// Anonymize user data in all contacts AND close the conversation
await Contact.updateMany(
  { userId: req.user._id },
  {
    $set: {
      name: null,
      email: deletedEmail,
      phone: null,
      status: 'closed',  // AJOUTÉ
    }
  }
);
```

---

## 8. Suppression de Compte - Réservations Actives (2 Février)

### Problème
Le frontend vérifiait `ACTIVE_RESERVATIONS` mais le backend retournait `ACTIVE_RESERVATIONS_WARNING`. Le flow de confirmation ne fonctionnait pas.

### Solution Frontend

**src/pages/profile/Profile.jsx** :
```javascript
} else if (result.code === 'ACTIVE_RESERVATIONS_WARNING') {  // Était 'ACTIVE_RESERVATIONS'
  setActiveReservations(result.reservations || [])
  setDeleteModalStep('confirm-reservations')
}
```

**Tests mis à jour** : `src/__tests__/api/authApi.test.js`

---

## 9. Message Conflit Réservation (31 Janvier)

### Problème
Message générique "Duplicate field value entered" lors d'une réservation simultanée sur le même créneau.

### Solution

**controllers/reservationController.js** :
```javascript
// Dans le catch du duplicate key error
if (error.code === 11000) {
  return res.status(409).json({
    success: false,
    error: 'Sorry, someone just booked the same table(s) for this time slot.',
    code: 'RESERVATION_CONFLICT'
  });
}
```

---

## 10. Autres Corrections (Session précédente - 27 Décembre)

Référence : `SESSION_CONTEXT.md`

- Police Sansation remplacée (Inter)
- Pagination admin contacts (limit: 1000)
- Reviews filtrées (uniquement avec commentaires)
- Dockerisation frontend/backend
- Images menu Unsplash

---

## Structure des Branches

### Backend (restOh-back)
```
main                                  = Référence stable
fix/safari-itp-localstorage-fallback  = Version déployée sur Render
                                        (contient les fixes Safari + autres)
```

### Frontend (restoh-frontend)
```
main                    = Version référence (sans workarounds Safari)
deploy/cloudflare       = Version déployée sur Cloudflare
                          - Tout ce qui est sur main
                          - PLUS: tokenStorage.js, AuthContext, etc.
```

### Workflow
1. Faire les corrections sur `main`
2. Merger `main` → `deploy/cloudflare` pour déployer
3. Pour le backend: travailler sur `fix/safari-itp-localstorage-fallback` pour déployer

---

## Fichiers Clés Modifiés/Créés

### Backend
| Fichier | Modification |
|---------|--------------|
| `server.js` | `app.set('trust proxy', 1)` |
| `utils/tokenUtils.js` | `sameSite: 'none'` en production |
| `utils/authCookies.js` | `sameSite: 'none'` en production |
| `controllers/authController.js` | Refresh token dans body, fermeture conversations |
| `models/Contact.js` | Transform id pour subdocuments discussion |
| `controllers/reservationController.js` | Message conflit user-friendly |

### Frontend (deploy/cloudflare)
| Fichier | Modification |
|---------|--------------|
| `src/utils/tokenStorage.js` | **NOUVEAU** - Safari detection + localStorage |
| `src/contexts/AuthContext.jsx` | **NOUVEAU** - Context wrapper pour Zustand |
| `src/main.jsx` | Wrap avec AuthProvider |
| `src/hooks/useAuth.js` | Utilise useAuthContext |
| `src/App.jsx` | Session restore toujours + useAuthContext |
| `src/store/authStore.js` | Safari localStorage fallback |
| `src/api/authApi.js` | Envoie refresh token depuis localStorage |
| `src/api/apiClient.js` | Idem dans l'intercepteur |
| `src/components/layout/Header.jsx` | Menu mobile complet |
| `src/pages/contact/MyMessages.jsx` | id au lieu de _id |
| `src/pages/profile/Profile.jsx` | Code erreur réservations |
| `public/404.html` | SPA fallback Cloudflare |

---

## Problème Non Résolu : Session Safari après Refresh

**Symptôme** : Sur Safari/iOS, après refresh de page, l'utilisateur est parfois déconnecté.

**Diagnostic** :
- Le refresh token est bien stocké en localStorage ✓
- L'appel `/auth/refresh` réussit ✓
- L'accessToken est bien stocké dans le state ✓
- L'appel `/auth/me` échoue parfois avec "unable to contact server" ✗

**Cause probable** : Restriction de sécurité Safari pour requêtes successives cross-origin. Timing issue possible.

**Workaround actuel** : Les utilisateurs doivent parfois se reconnecter après refresh sur Safari.

**Solution permanente** : Utiliser le même domaine (subdomains) :
- Frontend : `app.restoh.com`
- Backend : `api.restoh.com`

---

## Commandes Utiles

```bash
# Backend - Voir l'état
cd /Users/christophebouriel/Documents/Code/Training-IA/restOh-back
git status
git log --oneline -10

# Frontend - Voir l'état
cd /Users/christophebouriel/Documents/Code/Training-IA/restoh-frontend
git status
git branch  # Vérifier sur quelle branche

# Frontend - Basculer entre branches
git checkout main           # Pour développement
git checkout deploy/cloudflare  # Pour voir/modifier version déployée

# Frontend - Déployer (après commit sur main)
git checkout deploy/cloudflare
git merge main
git push origin deploy/cloudflare

# Backend - Déployer
git checkout fix/safari-itp-localstorage-fallback
# (faire les commits)
git push origin fix/safari-itp-localstorage-fallback
```

---

## Prochaines Tâches Identifiées

1. **Démo (restOh-front)** - Appliquer les corrections menu mobile (voir DEMO_FIXES_RECAP.md)
2. **Session Safari refresh** - Investigation plus poussée ou migration vers même domaine
3. **Merge backend sur main** - Une fois les fixes Safari stabilisés

---

## À Vérifier Plus Tard

### Email Verification - Double appel Safari (2 Février)

**Symptôme** : Sur Safari/iOS, après clic sur le lien de vérification email, le user est vérifié en base mais le frontend affiche "token expiré".

**Cause probable** : Double appel API (React StrictMode + Safari timing). Le premier appel réussit et supprime le token, le second ne le trouve plus.

**Fix appliqué** (branche `fix/safari-itp-localstorage-fallback` uniquement) :
- `controllers/emailController.js` : Utilise `markAsUsed()` au lieu de `deleteOne()` après vérification
- Si le token est déjà "used" mais l'user est vérifié → retourne succès au lieu d'erreur

**À vérifier** :
- [ ] Tester sur Safari/iOS que la vérification email fonctionne sans message d'erreur
- [ ] Vérifier si ce fix doit être mergé sur `main` ou s'il est spécifique Safari
- [ ] Investiguer si le double appel vient de React StrictMode ou d'autre chose

---

*Document mis à jour le 2 février 2026*
