# Frontend Integration: Email Verification Enforcement

## Overview

As of December 14, 2025, the backend now enforces email verification for sensitive operations. Users with unverified emails will receive a **403 Forbidden** response when attempting these actions.

## Affected Endpoints

| Endpoint | Method | Operation |
|----------|--------|-----------|
| `/api/orders` | POST | Create order |
| `/api/reservations` | POST | Create reservation |
| `/api/reservations/:id` | PUT | Update reservation |
| `/api/payments/stripe/create-intent` | POST | Create payment intent |
| `/api/payments/stripe/confirm` | POST | Confirm payment |
| `/api/menu/:id/review` | POST | Add menu item review |
| `/api/review/:reviewId` | PUT | Update review |
| `/api/review/:reviewId` | DELETE | Delete review |
| `/api/restaurant/review` | POST | Add restaurant review |
| `/api/restaurant/review/:id` | PUT | Update restaurant review |
| `/api/restaurant/review/:id` | DELETE | Delete restaurant review |

## Unaffected Operations (No verification required)

- Viewing orders (`GET /api/orders`)
- Viewing reservations (`GET /api/reservations`)
- Viewing menu items and reviews
- Viewing payment methods
- Profile viewing and basic updates
- Canceling reservations/orders

## Error Response Format

When an unverified user attempts a protected operation:

```json
{
  "success": false,
  "error": "Email verification required",
  "code": "AUTH_EMAIL_NOT_VERIFIED",
  "details": {
    "message": "You must verify your email address before performing this action.",
    "suggestion": "Please check your inbox for the verification email, or request a new one.",
    "action": "resend-verification"
  }
}
```

**HTTP Status Code**: `403 Forbidden`

## Frontend Implementation Guide

### 1. API Error Handler Update

Add handling for the new error code in your API interceptor:

```typescript
// api/interceptors.ts or similar
import { useAuthStore } from '@/stores/authStore';

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorCode = error.response?.data?.code;

    if (errorCode === 'AUTH_EMAIL_NOT_VERIFIED') {
      // Option 1: Show modal/toast
      showEmailVerificationPrompt();

      // Option 2: Redirect to verification page
      // router.push('/verify-email-required');

      // Option 3: Update global state
      useAuthStore.getState().setEmailVerificationRequired(true);
    }

    return Promise.reject(error);
  }
);
```

### 2. Email Verification Prompt Component

```tsx
// components/EmailVerificationPrompt.tsx
import { useState } from 'react';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Button } from '@/components/ui/Button';
import { resendVerificationEmail } from '@/api/auth';

interface Props {
  userEmail: string;
  onClose: () => void;
}

export function EmailVerificationPrompt({ userEmail, onClose }: Props) {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendVerificationEmail();
      setResendSuccess(true);
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-4">
          Vérification de l'email requise
        </h2>

        <InlineAlert
          type="warning"
          title="Action bloquée"
          message="Vous devez vérifier votre adresse email avant de pouvoir effectuer cette action."
        />

        <p className="mt-4 text-gray-600">
          Un email de vérification a été envoyé à <strong>{userEmail}</strong>.
          Cliquez sur le lien dans l'email pour vérifier votre compte.
        </p>

        {resendSuccess ? (
          <InlineAlert
            type="success"
            title="Email envoyé"
            message="Un nouvel email de vérification vous a été envoyé."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-500">
              Vous n'avez pas reçu l'email ?
            </p>
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? 'Envoi en cours...' : 'Renvoyer l\'email'}
            </Button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 3. InlineAlert Integration

If using the existing `InlineAlert` component pattern:

```tsx
// Handle AUTH_EMAIL_NOT_VERIFIED in your form submissions
const handleSubmit = async () => {
  try {
    await createOrder(orderData);
  } catch (error) {
    if (error.response?.data?.code === 'AUTH_EMAIL_NOT_VERIFIED') {
      setAlert({
        type: 'warning',
        title: 'Vérification requise',
        message: error.response.data.details.message,
        action: {
          label: 'Renvoyer l\'email',
          onClick: handleResendVerification
        }
      });
    }
  }
};
```

### 4. Check Verification Status in User Store

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  isEmailVerified: boolean;
  // ...
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,

  // Computed from user object
  get isEmailVerified() {
    return get().user?.isEmailVerified ?? false;
  },

  // Action to refresh user data after verification
  refreshUser: async () => {
    const response = await api.get('/auth/me');
    set({ user: response.data.user });
  }
}));
```

### 5. Pre-emptive UI Warning

Show a warning banner for unverified users:

```tsx
// components/layouts/MainLayout.tsx
import { useAuthStore } from '@/stores/authStore';

export function MainLayout({ children }) {
  const { user, isEmailVerified } = useAuthStore();

  return (
    <div>
      {user && !isEmailVerified && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <p className="text-yellow-800">
              <span className="font-medium">Email non vérifié.</span>
              {' '}Certaines fonctionnalités sont limitées.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resendVerificationEmail()}
            >
              Renvoyer l'email
            </Button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
```

### 6. Disable Actions for Unverified Users

Optionally disable buttons/forms preemptively:

```tsx
// components/OrderButton.tsx
import { useAuthStore } from '@/stores/authStore';

export function OrderButton({ onClick, children }) {
  const { isEmailVerified } = useAuthStore();

  if (!isEmailVerified) {
    return (
      <Tooltip content="Vérifiez votre email pour commander">
        <Button disabled>
          {children}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button onClick={onClick}>
      {children}
    </Button>
  );
}
```

## API Endpoints for Email Verification

### Resend Verification Email

```
POST /api/email/resend-verification
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "Verification email sent successfully"
}
```

### Verify Email (from email link)

```
GET /api/email/verify/:token

Response (200):
{
  "success": true,
  "message": "Email verified successfully"
}

Response (400 - invalid/expired token):
{
  "success": false,
  "error": "Invalid or expired verification token"
}
```

## User Flow

1. User registers -> `isEmailVerified: false`
2. Verification email sent automatically
3. User can browse, view orders/reservations
4. User tries to create order -> receives 403 with `AUTH_EMAIL_NOT_VERIFIED`
5. Frontend shows prompt with "Resend email" option
6. User clicks link in email -> `isEmailVerified: true`
7. User can now perform all operations

## Testing

To test unverified user behavior:

```bash
# Create user via API (will have isEmailVerified: false by default)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'

# Try to create order (should fail with 403)
curl -X POST http://localhost:3001/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"items":[...]}'

# Expected response:
# HTTP 403
# {"success":false,"code":"AUTH_EMAIL_NOT_VERIFIED",...}
```

## Migration Notes

- Existing users with `isEmailVerified: undefined` will be treated as unverified
- Consider running a migration to set `isEmailVerified: true` for existing active users if you don't want to disrupt them
- Test helpers now create users with `isEmailVerified: true` by default to avoid breaking existing tests
