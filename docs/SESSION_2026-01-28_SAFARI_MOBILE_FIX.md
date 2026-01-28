# Session du 28 janvier 2026 - Corrections Safari/iOS et Menu Mobile

## Contexte initial

- **Problème principal** : Après déploiement sur Render (backend) et Cloudflare Pages (frontend), le login fonctionnait (toast "successfully logged") mais l'utilisateur n'apparaissait pas connecté dans l'UI sur Safari/iOS.
- **Environnement** :
  - Backend : https://restoh-backend.onrender.com
  - Frontend : Cloudflare Pages (branche `deploy/cloudflare`)
  - Variable d'environnement Cloudflare : `VITE_API_URL=https://restoh-backend.onrender.com/api`

---

## Problèmes identifiés et corrections

### 1. Trust Proxy (Backend - Render)

**Problème** : Erreur `ValidationError` sur `X-Forwarded-For` avec express-rate-limit.

**Solution** : Ajout dans `server.js` :
```javascript
app.set('trust proxy', 1);
```
**Fichier** : `/restOh-back/server.js`

---

### 2. Cookies SameSite (Backend)

**Problème** : Les cookies cross-origin étaient bloqués avec `sameSite: 'strict'`.

**Solution** : Changement en `sameSite: 'none'` pour la production.

**Fichiers modifiés** :
- `/restOh-back/utils/tokenUtils.js`
- `/restOh-back/utils/authCookies.js`

```javascript
const getRefreshTokenCookieOptions = (rememberMe) => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',  // 'none' pour cross-origin en prod
    maxAge,
    path: '/api/auth',
  };
};
```

---

### 3. Safari ITP - localStorage Fallback (Frontend + Backend)

**Problème** : Safari ITP (Intelligent Tracking Prevention) bloque les cookies cross-origin même avec `sameSite: 'none'`.

**Solution** : Fallback localStorage pour le refresh token sur Safari/iOS.

#### Backend (`/restOh-back/controllers/authController.js`)

- Login retourne aussi `refreshToken` dans le body (pas seulement en cookie)
- `/auth/refresh` accepte le token depuis `req.body?.refreshToken`
- `/auth/logout` accepte le token depuis `req.body?.refreshToken`

#### Frontend (branche `deploy/cloudflare`)

**Nouveau fichier** : `/restoh-frontend/src/utils/tokenStorage.js`
```javascript
export const isSafariOrIOS = () => { /* détection Safari/iOS */ }
export const needsLocalStorageFallback = () => isSafariOrIOS()
export const storeRefreshToken = (token) => localStorage.setItem('rt_fallback', token)
export const getStoredRefreshToken = () => localStorage.getItem('rt_fallback')
export const clearStoredRefreshToken = () => localStorage.removeItem('rt_fallback')
```

**Fichiers modifiés** :
- `/restoh-frontend/src/store/authStore.js` - stocke le refresh token en localStorage sur Safari
- `/restoh-frontend/src/api/authApi.js` - envoie le token depuis localStorage si Safari
- `/restoh-frontend/src/api/apiClient.js` - idem pour l'intercepteur de refresh

---

### 4. React Context Wrapper pour Zustand (Frontend)

**Problème** : Zustand's `useSyncExternalStore` ne déclenche pas toujours les re-renders sur iOS WebKit.

**Solution** : Créer un Context React qui wrappe le store Zustand.

**Nouveau fichier** : `/restoh-frontend/src/contexts/AuthContext.jsx`

**Fichiers modifiés** :
- `/restoh-frontend/src/main.jsx` - wrap avec `<AuthProvider>`
- `/restoh-frontend/src/hooks/useAuth.js` - utilise `useAuthContext` au lieu de `useAuthStore`
- `/restoh-frontend/src/App.jsx` - utilise `useAuthContext`
- Tous les composants qui utilisaient `useAuthStore` directement

**Note** : Cette solution n'a pas complètement résolu le problème de session sur Safari (problème réseau lors du `getCurrentUser` après refresh), mais reste en place sur la branche `deploy/cloudflare`.

---

### 5. Menu Mobile - Corrections Majeures (Frontend)

**Problème** : Le menu mobile (burger) n'avait jamais été implémenté pour :
- Afficher l'état authentifié (affichait toujours "Login")
- Afficher le vrai nombre d'articles dans le panier (affichait "(0)" en dur)
- Ouvrir le panier (redirigeait vers checkout)
- Afficher "Admin Panel" pour les admins

**Solution** : Refonte complète du menu mobile.

**Fichier** : `/restoh-frontend/src/components/layout/Header.jsx`

**Changements** :
```jsx
// AVANT (menu mobile)
<Link to={ROUTES.CHECKOUT}>Cart (0)</Link>
<Link to={ROUTES.LOGIN}>Login</Link>

// APRÈS
<button onClick={() => { setIsMenuOpen(false); setTimeout(() => toggleCart(), 100) }}>
  Cart ({totalItemsAvailable})
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
```

**Cette correction est sur `main` ET `deploy/cloudflare`.**

---

## Structure des branches (Frontend)

```
main                    = Version "exemplaire" / référence
                          - Corrections menu mobile
                          - Pour développement local / démo

deploy/cloudflare       = Version déployée sur Cloudflare
                          - Tout ce qui est sur main
                          - PLUS : workarounds Safari (localStorage fallback, AuthContext)
```

### Workflow futur

1. Faire les corrections sur `main`
2. Merger `main` → `deploy/cloudflare` :
   ```bash
   git checkout deploy/cloudflare
   git merge main
   git push
   ```

### Configuration Cloudflare Pages

**Branche de production** : `deploy/cloudflare` (pas `main`)

---

## Problème non résolu : Session Safari après refresh

**Symptôme** : Sur Safari/iOS, après un refresh de page, l'utilisateur est déconnecté.

**Diagnostic** :
- Le refresh token est bien stocké en localStorage ✓
- L'appel `/auth/refresh` réussit ✓
- L'accessToken est bien stocké dans le state ✓
- L'appel `/auth/me` échoue avec "unable to contact server" ✗

**Cause probable** : Safari bloque la requête réseau pour une raison inconnue (pas CORS, pas mixed content). Possiblement lié au timing ou à une restriction de sécurité spécifique à Safari pour les requêtes successives cross-origin.

**Solution de contournement** : Informer les utilisateurs iOS de se reconnecter après un refresh (comme pour le cold start Render).

---

## Fichiers modifiés - Récapitulatif

### Backend (restOh-back) - sur `main`

| Fichier | Modification |
|---------|--------------|
| `server.js` | `app.set('trust proxy', 1)` |
| `utils/tokenUtils.js` | `sameSite: 'none'` en production |
| `utils/authCookies.js` | `sameSite: 'none'` en production |
| `controllers/authController.js` | Refresh token dans body + accepte depuis body |

### Frontend (restoh-frontend) - sur `main`

| Fichier | Modification |
|---------|--------------|
| `src/components/layout/Header.jsx` | Menu mobile complet (auth, cart, admin) |

### Frontend (restoh-frontend) - sur `deploy/cloudflare` uniquement

| Fichier | Modification |
|---------|--------------|
| `src/utils/tokenStorage.js` | NOUVEAU - détection Safari + localStorage fallback |
| `src/contexts/AuthContext.jsx` | NOUVEAU - Context wrapper pour Zustand |
| `src/main.jsx` | Wrap avec AuthProvider |
| `src/hooks/useAuth.js` | Utilise AuthContext |
| `src/App.jsx` | Utilise AuthContext, session restore toujours |
| `src/store/authStore.js` | Safari localStorage fallback |
| `src/api/authApi.js` | Envoie refresh token depuis localStorage |
| `src/api/apiClient.js` | Idem dans l'intercepteur |

---

## Commandes utiles

```bash
# Voir la branche courante
git branch

# Passer sur main pour développer
git checkout main

# Passer sur deploy/cloudflare pour voir la version Cloudflare
git checkout deploy/cloudflare

# Après des commits sur main, synchroniser deploy/cloudflare
git checkout deploy/cloudflare
git merge main
git push

# Voir les différences entre les branches
git diff main..deploy/cloudflare --stat
```

---

## Recherches effectuées

### Safari ITP et authentification cross-origin

**Conclusion** : La solution recommandée est d'utiliser le **même domaine** (subdomain) pour frontend et backend. Exemple :
- Frontend : `app.restoh.com`
- Backend : `api.restoh.com`

Cela évite tous les problèmes de cookies tiers. Actuellement non implémenté car nécessite un domaine personnalisé.

### Zustand + React Context

**Conclusion** : L'hybride est acceptable mais normalement pas nécessaire. Un bug documenté existe avec React 18 + Safari qui saute parfois des renders (GitHub Issue #26713).

**Sources consultées** :
- https://medium.com/@lucasrosvall/solving-cookie-issues-in-safari-for-your-web-app-08d21b72a004
- https://supertokens.com/docs/thirdparty/common-customizations/multiple-clients
- https://tkdodo.eu/blog/zustand-and-react-context
- https://github.com/facebook/react/issues/26713
