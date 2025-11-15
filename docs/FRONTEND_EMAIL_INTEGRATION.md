# 📧 Guide d'Intégration Email - Frontend

Guide rapide pour intégrer le système d'emails RestOh dans le frontend.

---

## 🚀 Quick Start

Le backend gère automatiquement :
- ✅ Envoi d'email de vérification à l'inscription
- ✅ Envoi d'email de reset password
- ✅ Gestion des tokens sécurisés
- ✅ Templates HTML professionnels

**Le frontend doit créer 2 pages et utiliser 3 endpoints.**

---

## 📋 Pages à Créer

### 1. Page de Vérification Email
**Route :** `/verify-email/:token`

**URL reçue par email :** `http://localhost:3000/verify-email/abc123def456...`

**Code Example (React) :**
```jsx
// pages/VerifyEmail.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await axios.get(
          `http://localhost:3001/api/email/verify/${token}`
        );

        setStatus('success');
        setMessage(response.data.message);

        // Rediriger vers login après 3 secondes
        setTimeout(() => navigate('/login'), 3000);

      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Verification failed');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="verify-email-page">
      {status === 'loading' && (
        <div>
          <h2>Verifying your email...</h2>
          <div className="spinner" />
        </div>
      )}

      {status === 'success' && (
        <div className="success">
          <h2>✓ Email Verified!</h2>
          <p>{message}</p>
          <p>Redirecting to login...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="error">
          <h2>✗ Verification Failed</h2>
          <p>{message}</p>
          <button onClick={() => navigate('/resend-verification')}>
            Resend Verification Email
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### 2. Page Reset Password
**Route :** `/reset-password/:token`

**URL reçue par email :** `http://localhost:3000/reset-password/xyz789abc123...`

**Code Example (React) :**
```jsx
// pages/ResetPassword.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import axios from 'axios';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `http://localhost:3001/api/email/reset-password/${token}`,
        { password }
      );

      setSuccess(true);

      // Rediriger vers login après 2 secondes
      setTimeout(() => navigate('/login'), 2000);

    } catch (error) {
      setError(error.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success">
        <h2>✓ Password Reset Successfully!</h2>
        <p>You can now login with your new password.</p>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <h2>Reset Your Password</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password (min 6 characters)"
            required
          />
        </div>

        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}
```

---

## 🔌 API Endpoints à Utiliser

### 1. Forgot Password (Page "Mot de passe oublié")

**Endpoint :** `POST /api/email/forgot-password`

**Code Example :**
```jsx
// pages/ForgotPassword.jsx
import { useState } from 'react';
import axios from 'axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(
        'http://localhost:3001/api/email/forgot-password',
        { email }
      );

      setSuccess(true);

    } catch (error) {
      setError(error.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success">
        <h2>✓ Check Your Email</h2>
        <p>If an account with that email exists, we've sent you a password reset link.</p>
        <p>The link will expire in 30 minutes.</p>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <h2>Forgot Password?</h2>
      <p>Enter your email address and we'll send you a reset link.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}
```

---

### 2. Resend Verification Email (Optionnel)

**Endpoint :** `POST /api/email/resend-verification`

**Quand l'utiliser :**
- User n'a pas reçu l'email
- Email de vérification expiré (24h)

**Code Example :**
```jsx
// components/ResendVerification.jsx
import { useState } from 'react';
import axios from 'axios';

export default function ResendVerification() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResend = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        'http://localhost:3001/api/email/resend-verification',
        { email }
      );
      setSuccess(true);
    } catch (error) {
      console.error('Failed to resend', error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success">
        <p>✓ Verification email sent! Check your inbox.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleResend}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Resend Verification Email'}
      </button>
    </form>
  );
}
```

---

## 🔐 Gérer les Notifications Utilisateur

### Paramètres de Notifications (dans le profil user)

**Endpoint :** `PUT /api/auth/profile`

```jsx
// components/NotificationSettings.jsx
import { useState } from 'react';
import axios from 'axios';

export default function NotificationSettings({ user }) {
  const [notifications, setNotifications] = useState({
    newsletter: user?.notifications?.newsletter ?? true,
    promotions: user?.notifications?.promotions ?? true,
  });

  const handleToggle = async (type) => {
    const newValue = !notifications[type];

    try {
      await axios.put(
        'http://localhost:3001/api/auth/profile',
        {
          notifications: {
            ...notifications,
            [type]: newValue
          }
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setNotifications(prev => ({
        ...prev,
        [type]: newValue
      }));

    } catch (error) {
      console.error('Failed to update notifications', error);
    }
  };

  return (
    <div className="notification-settings">
      <h3>Email Preferences</h3>

      <div className="toggle-item">
        <label>
          <input
            type="checkbox"
            checked={notifications.newsletter}
            onChange={() => handleToggle('newsletter')}
          />
          <span>Newsletter (monthly updates)</span>
        </label>
      </div>

      <div className="toggle-item">
        <label>
          <input
            type="checkbox"
            checked={notifications.promotions}
            onChange={() => handleToggle('promotions')}
          />
          <span>Promotions (special offers)</span>
        </label>
      </div>
    </div>
  );
}
```

---

## 📱 Flow Utilisateur Complet

### Flow 1 : Inscription + Vérification

```
1. User remplit formulaire d'inscription
   ↓
2. POST /api/auth/register
   ↓
3. Backend crée user + envoie email ✉️
   ↓
4. User reçoit email "Verify Your Email"
   ↓
5. User clique sur le lien
   ↓
6. Frontend route: /verify-email/:token
   ↓
7. GET /api/email/verify/:token
   ↓
8. ✓ Email vérifié → Redirection /login
```

### Flow 2 : Mot de Passe Oublié

```
1. User clique "Forgot Password?"
   ↓
2. Page /forgot-password
   ↓
3. User entre son email
   ↓
4. POST /api/email/forgot-password
   ↓
5. Backend envoie email ✉️
   ↓
6. User reçoit email "Reset Your Password"
   ↓
7. User clique sur le lien
   ↓
8. Frontend route: /reset-password/:token
   ↓
9. User entre nouveau mot de passe
   ↓
10. POST /api/email/reset-password/:token
    ↓
11. ✓ Password reset → Redirection /login
```

---

## 📡 Configuration Axios (Recommandé)

```jsx
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

**Utilisation :**
```jsx
import api from './services/api';

// Au lieu de axios.post(...), utiliser :
await api.post('/email/forgot-password', { email });
```

---

## 🎨 UI/UX Recommandations

### Après Inscription

```jsx
<div className="registration-success">
  <h2>✓ Account Created!</h2>
  <p>We've sent a verification email to <strong>{email}</strong></p>
  <p>Please check your inbox and click the verification link.</p>

  <div className="note">
    <p>Didn't receive the email?</p>
    <button onClick={handleResend}>Resend Email</button>
  </div>
</div>
```

### Indicateur Email Non Vérifié (dans le Dashboard)

```jsx
{!user.isEmailVerified && (
  <div className="alert alert-warning">
    <p>⚠️ Your email is not verified.</p>
    <button onClick={handleResendVerification}>
      Verify Email
    </button>
  </div>
)}
```

---

## ⚠️ Erreurs Courantes

### Erreur : Token Expiré

**Email de vérification :** 24h
**Password reset :** 30 minutes

```jsx
// Afficher message approprié
{error.includes('expired') && (
  <div>
    <p>This link has expired.</p>
    <button onClick={handleResend}>Request New Link</button>
  </div>
)}
```

### Erreur : Token Invalide

```jsx
{error.includes('Invalid') && (
  <div>
    <p>This link is invalid or has already been used.</p>
    <a href="/forgot-password">Request a new reset link</a>
  </div>
)}
```

---

## 🧪 Testing en Local

### 1. Tester l'inscription
```bash
# Le backend envoie automatiquement l'email
# Vérifie les logs backend pour voir :
✓ Verification email sent to user@example.com
```

### 2. Récupérer le token de test (en dev)
```javascript
// Dans la console MongoDB ou backend logs
// Le token ressemble à : abc123def456...789
```

### 3. Tester manuellement
```
http://localhost:3000/verify-email/abc123def456...789
http://localhost:3000/reset-password/xyz789abc123...456
```

---

## 📦 Variables d'Environnement Frontend

```env
# .env (React)
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_FRONTEND_URL=http://localhost:3000
```

```env
# .env.local (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

---

## ✅ Checklist d'Intégration

- [ ] Route `/verify-email/:token` créée
- [ ] Route `/reset-password/:token` créée
- [ ] Page "Forgot Password" créée
- [ ] Fonction "Resend Verification" ajoutée
- [ ] Paramètres de notifications dans le profil
- [ ] Indicateur "email non vérifié" dans le dashboard
- [ ] Messages d'erreur gérés (token expiré, invalide)
- [ ] Variables d'environnement configurées
- [ ] Tests des flows complets

---

## 🚀 Prêt à Coder !

Tout est prêt côté backend. Tu as juste à :
1. Copier les exemples de code ci-dessus
2. Adapter le style à ton design
3. Tester les flows

**Besoin d'aide ?** Consulte `/docs/EMAIL_SYSTEM.md` pour plus de détails backend.
