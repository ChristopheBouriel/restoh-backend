# RestOh - Infrastructure & DevOps

Documentation des pratiques CI/CD, containerisation et déploiement du projet RestOh.

## Architecture de Déploiement

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                     Docker Network                          │
                    │                                                             │
  ┌──────────┐      │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
  │  Client  │─────▶│  │   Frontend   │───▶│   Backend    │───▶│   MongoDB    │  │
  │ Browser  │      │  │   (Nginx)    │    │  (Node.js)   │    │   (Mongo 7)  │  │
  └──────────┘      │  │   :5173      │    │   :3001      │    │   :27017     │  │
                    │  └──────────────┘    └──────────────┘    └──────────────┘  │
                    │                                                             │
                    └─────────────────────────────────────────────────────────────┘
```

## Repositories

| Repository | Description | Docker Hub |
|------------|-------------|------------|
| [restoh-frontend](https://github.com/cbouriel/restoh-frontend) | React 18 SPA | `cbouriel/restoh-frontend` |
| [restoh-backend](https://github.com/cbouriel/restoh-backend) | Node.js/Express API | `cbouriel/restoh-backend` |
| [restoh-docker](https://github.com/cbouriel/restoh-docker) | Docker Compose orchestration | - |

---

## CI/CD Pipelines

### Frontend CI (`.github/workflows/ci.yml`)

**Déclencheurs :** Push/PR sur `main`

```yaml
Jobs:
  test:
    - Checkout code
    - Setup Node.js 22
    - npm ci
    - npm run lint
    - npm test (1620+ tests Vitest)
    - npm run build
```

**Durée moyenne :** ~2 minutes

### Backend CI (`.github/workflows/ci.yml`)

**Déclencheurs :** Push/PR sur `main`, `develop`

```yaml
Jobs:
  test:
    - Checkout code
    - Setup Node.js 20
    - npm ci
    - npm run lint
    - npm test (unit + integration)
    - Upload coverage report

  build:
    - needs: test
    - npm ci --only=production
    - Verify server can start (timeout 10s)

  docker:
    - needs: test
    - Build Docker image
    - Test Docker image (sans MongoDB)
```

**Durée moyenne :** ~3 minutes

### E2E Tests (`.github/workflows/e2e.yml`)

**Déclencheurs :** Manual, repository_dispatch

Tests end-to-end Playwright avec stack complète :

```yaml
Services:
  - MongoDB 7 (ephemeral)

Steps:
  - Checkout backend + frontend
  - Seed E2E database
  - Start backend server
  - Install Playwright browsers
  - Run E2E tests (chromium)
  - Upload Playwright report
```

**Couverture E2E :** 17 fichiers de tests, accessibilité (axe-core)

---

## Containerisation

### Frontend Dockerfile

```dockerfile
# Build stage - Node.js
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Optimisations :**
- Build multi-stage (image finale ~23MB)
- Nginx avec gzip, cache static assets
- Security headers (X-Frame-Options, X-Content-Type-Options)
- SPA routing (`try_files $uri /index.html`)

### Backend Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
```

**Optimisations :**
- Image Alpine légère (~77MB)
- Production dependencies only
- Non-root user (sécurité)
- Healthcheck intégré

### Docker Compose

Orchestration des 3 services avec :
- Network bridge isolé
- Volume persistant MongoDB
- Healthchecks et depends_on
- Variables d'environnement configurables

---

## Quick Start

```bash
# Clone le repo d'orchestration
git clone https://github.com/cbouriel/restoh-docker.git
cd restoh-docker

# Configuration
cp .env.example .env
# Éditer .env si nécessaire

# Démarrage
docker-compose up -d

# Seed de la base de données
docker exec restoh-backend node seeds/seed-all.js

# Accès
# Frontend: http://localhost:5173
# API: http://localhost:3001/api
# Admin: admin@restoh.com / admin123
```

---

## Commandes Utiles

### Gestion des containers

```bash
# Status
docker-compose ps

# Logs
docker-compose logs -f backend

# Restart un service
docker-compose restart backend

# Stop tout
docker-compose down

# Reset complet (avec volumes)
docker-compose down -v
```

### Mise à jour des images

```bash
# Pull les dernières images
docker-compose pull

# Redémarrer avec les nouvelles images
docker-compose up -d
```

### Database

```bash
# Seed complet
docker exec restoh-backend node seeds/seed-all.js

# Seed individuel
docker exec restoh-backend node seeds/seed-menu.js
docker exec restoh-backend node seeds/seed-users.js

# Accès MongoDB shell
docker exec -it restoh-mongodb mongosh -u admin -p <password> --authenticationDatabase admin
```

### Build local des images

```bash
# Frontend
cd restoh-frontend
docker build -t cbouriel/restoh-frontend:latest .

# Backend
cd restoh-backend
docker build -t cbouriel/restoh-backend:latest .

# Push sur Docker Hub
docker push cbouriel/restoh-frontend:latest
docker push cbouriel/restoh-backend:latest
```

---

## Variables d'Environnement

### Requises

| Variable | Description | Défaut |
|----------|-------------|--------|
| `MONGO_ROOT_USERNAME` | MongoDB admin user | `admin` |
| `MONGO_ROOT_PASSWORD` | MongoDB admin password | - |
| `JWT_SECRET` | JWT signing secret (32+ chars) | - |
| `JWT_REFRESH_SECRET` | Refresh token secret | - |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:5173` |

### Optionnelles

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` / `development` |
| `JWT_EXPIRE` | Access token expiry (défaut: `15m`) |
| `JWT_REFRESH_EXPIRE` | Refresh token expiry (défaut: `7d`) |
| `BREVO_API_KEY` | Email service |
| `STRIPE_SECRET_KEY` | Payment processing |
| `CLOUDINARY_*` | Image upload |

---

## Tests

### Suite de tests

| Type | Outil | Quantité | Couverture |
|------|-------|----------|------------|
| Unit Frontend | Vitest + RTL | 1620+ | Stores, hooks, services, components |
| Unit Backend | Jest | 100+ | Controllers, middleware, utils |
| Integration Backend | Jest + Supertest | 14 suites | API endpoints |
| E2E | Playwright | 17 fichiers | Flows utilisateur complets |
| Accessibilité | axe-core | Intégré E2E | WCAG 2.1 AA |

### Commandes

```bash
# Frontend
npm test              # Tous les tests
npm run test:ui       # Interface Vitest
npm run test:coverage # Couverture

# Backend
npm test              # Tous les tests
npm run test:watch    # Mode watch
npm run test:coverage # Couverture

# E2E (depuis frontend)
npx playwright test
npx playwright test --ui  # Mode interactif
```

---

## Sécurité

### Mesures implémentées

- **Authentification** : JWT + Refresh tokens en cookies HTTP-only
- **CORS** : Origins explicites configurables
- **Rate limiting** : Protection API en production
- **Headers sécurité** : X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **Non-root user** : Container backend s'exécute en utilisateur nodejs
- **Secrets** : Variables d'environnement, jamais dans le code

### Bonnes pratiques

- Ne jamais commiter `.env` (utiliser `.env.example`)
- Changer les secrets par défaut en production
- Utiliser des mots de passe forts pour MongoDB
- Activer HTTPS en production (reverse proxy)

---

## Monitoring

### Healthchecks

```bash
# API Backend
curl http://localhost:3001/api/health
# Réponse: {"status":"ok","timestamp":"...","uptime":...,"environment":"production","checks":{"database":"ok"}}

# MongoDB
docker inspect restoh-mongodb | grep -A 10 "Health"
```

### Logs

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f backend --tail 100

# Logs avec timestamps
docker-compose logs -f -t
```

---

## Roadmap DevOps

- [ ] GitHub Actions : Push automatique des images Docker sur tag
- [ ] Déploiement cloud (Railway, Render, ou VPS)
- [ ] Monitoring avec Prometheus/Grafana
- [ ] Backup automatisé MongoDB
- [ ] SSL/TLS avec Let's Encrypt
- [ ] Load balancing pour scaling horizontal

---

*Dernière mise à jour : Décembre 2024*
