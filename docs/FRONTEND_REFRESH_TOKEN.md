# Frontend Integration: Refresh Token System

## Overview

As of December 2025, the backend implements a dual-token authentication system:

| Token | Type | Duration | Storage | Transmission |
|-------|------|----------|---------|--------------|
| **Access Token** | JWT | 15 minutes | Memory (JS variable) | `Authorization: Bearer` header |
| **Refresh Token** | Random string | 7 days | HttpOnly cookie + DB | Automatic (cookie) |

## Why This Change?

**Before (vulnerable):**
- Single JWT stored in cookie (30 days)
- Logout only cleared client-side cookie
- Stolen token valid for full 30 days

**After (secure):**
- Access token expires in 15 min (limits exposure window)
- Refresh token stored in DB (revocable immediately)
- Logout actually invalidates the token

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

1. LOGIN
   POST /api/auth/login
   Request:  { email, password }
   Response: { success, accessToken, user }
   Cookie:   refreshToken (HttpOnly, 7 days)

2. API REQUESTS
   GET /api/any-protected-route
   Header:   Authorization: Bearer <accessToken>

3. TOKEN EXPIRED (after ~15 min)
   Response: 401 { code: "AUTH_TOKEN_EXPIRED" }

4. REFRESH TOKEN
   POST /api/auth/refresh
   Cookie:   refreshToken (sent automatically)
   Response: { success, accessToken }

5. RETRY ORIGINAL REQUEST
   With new accessToken

6. LOGOUT
   POST /api/auth/logout
   → Revokes refresh token in database
   → Clears cookies
```

## API Endpoints

### Login
```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    ...
  }
}

Set-Cookie: refreshToken=<token>; HttpOnly; Path=/api/auth; Max-Age=604800
```

### Refresh Token
```
POST /api/auth/refresh
Cookie: refreshToken=<token> (sent automatically by browser)

Response (200):
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response (401 - No token):
{
  "success": false,
  "error": "No refresh token provided",
  "code": "AUTH_NO_REFRESH_TOKEN",
  "details": {
    "action": "redirect-to-login"
  }
}

Response (401 - Invalid/expired token):
{
  "success": false,
  "error": "Invalid or expired refresh token",
  "code": "AUTH_INVALID_REFRESH_TOKEN",
  "details": {
    "action": "redirect-to-login"
  }
}
```

### Logout (Single Device)
```
POST /api/auth/logout
Authorization: Bearer <accessToken>
Cookie: refreshToken=<token>

Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Logout All Devices
```
POST /api/auth/logout-all
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "message": "Logged out from all devices",
  "details": {
    "revokedSessions": 3
  }
}
```

## Error Codes

| Code | HTTP Status | Meaning | Frontend Action |
|------|-------------|---------|-----------------|
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired | Call `/api/auth/refresh` |
| `AUTH_NO_REFRESH_TOKEN` | 401 | No refresh token cookie | Redirect to login |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Refresh token revoked/expired | Redirect to login |

## Frontend Implementation

### 1. Auth Store (Zustand example)

```typescript
// stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAuth: (accessToken: string, user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (accessToken, user) => set({
    accessToken,
    user,
    isAuthenticated: true,
  }),

  setAccessToken: (accessToken) => set({ accessToken }),

  clearAuth: () => set({
    accessToken: null,
    user: null,
    isAuthenticated: false,
  }),
}));
```

### 2. API Client with Auto-Refresh

```typescript
// api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  withCredentials: true, // Required for cookies
});

// Request interceptor: Add access token to headers
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: Handle token expiration
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is token expired
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'AUTH_TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint
        const response = await axios.post(
          'http://localhost:3001/api/auth/refresh',
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;

        // Update store with new token
        useAuthStore.getState().setAccessToken(accessToken);

        // Process queued requests
        processQueue(null, accessToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);

        // Refresh failed - clear auth and redirect
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other auth errors (no refresh token, invalid refresh token)
    if (
      error.response?.status === 401 &&
      ['AUTH_NO_REFRESH_TOKEN', 'AUTH_INVALID_REFRESH_TOKEN'].includes(
        error.response?.data?.code
      )
    ) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
```

### 3. Login Component

```typescript
// components/LoginForm.tsx
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/api/client';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;

      // Store access token in memory (NOT localStorage!)
      setAuth(accessToken, user);

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

### 4. Logout Handler

```typescript
// hooks/useLogout.ts
import { useAuthStore } from '@/stores/authStore';
import api from '@/api/client';

export function useLogout() {
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Even if API fails, clear local state
      console.error('Logout API error:', error);
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  };

  const logoutAll = async () => {
    try {
      const response = await api.post('/auth/logout-all');
      console.log(`Revoked ${response.data.details.revokedSessions} sessions`);
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  };

  return { logout, logoutAll };
}
```

### 5. App Initialization (Restore Session)

```typescript
// App.tsx or _app.tsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/api/client';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    // Try to restore session on app load
    const initAuth = async () => {
      try {
        // Attempt to refresh token (cookie is sent automatically)
        const refreshResponse = await api.post('/auth/refresh');
        const { accessToken } = refreshResponse.data;

        // Get user data
        const userResponse = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        setAuth(accessToken, userResponse.data.user);
      } catch (error) {
        // No valid session
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <RouterProvider />;
}
```

## Security Best Practices

### DO:
- Store access token in memory only (JS variable/state)
- Use `withCredentials: true` for all API calls
- Handle `AUTH_TOKEN_EXPIRED` by calling `/refresh`
- Clear auth state on any auth error
- Use HTTPS in production

### DON'T:
- Store access token in localStorage (XSS vulnerable)
- Store refresh token anywhere (it's HttpOnly cookie)
- Include tokens in URLs
- Log tokens to console in production

## Migration from Old System

### Breaking Changes

| Before | After |
|--------|-------|
| Token in cookie `token` | Access token in response body |
| Single token (30 days) | Access (15 min) + Refresh (7 days) |
| No refresh endpoint | `POST /api/auth/refresh` |
| Logout cleared cookie only | Logout revokes token in DB |

### Migration Steps

1. Update auth store to handle `accessToken` from response body
2. Add `Authorization: Bearer` header to all API calls
3. Implement token refresh interceptor
4. Update login to use new response format
5. Add `withCredentials: true` to axios config

## Testing

To test the refresh flow manually:

```bash
# 1. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# 2. Access protected route
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# 3. Refresh token
curl -X POST http://localhost:3001/api/auth/refresh \
  -b cookies.txt

# 4. Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  -b cookies.txt

# 5. Verify refresh fails after logout
curl -X POST http://localhost:3001/api/auth/refresh \
  -b cookies.txt
# Expected: 401 AUTH_INVALID_REFRESH_TOKEN
```
