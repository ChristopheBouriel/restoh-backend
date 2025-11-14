# Email System Documentation

## Overview

RestOh uses **Brevo (formerly Sendinblue)** as the email service provider for sending transactional and marketing emails. This document explains the email system architecture, setup, and usage.

## Why Brevo?

- ✅ **300 emails/day for free** (9,000/month)
- ✅ **No credit card required**
- ✅ Official Node.js SDK
- ✅ Excellent deliverability
- ✅ Both transactional and marketing emails
- ✅ Professional email templates
- ✅ Analytics included

## Architecture

```
services/email/
├── brevoConfig.js          # Brevo API configuration
├── emailService.js         # Centralized email service
└── templates/              # HTML email templates
    ├── verification.html   # Email verification
    ├── passwordReset.html  # Password reset
    ├── newsletter.html     # Newsletter
    └── promotion.html      # Promotional emails

models/
├── EmailVerification.js    # Email verification tokens (24h expiry)
└── PasswordReset.js       # Password reset tokens (30min expiry)

controllers/
├── emailController.js      # Email verification & password reset
└── newsletterController.js # Newsletter & promotions
```

## Setup Instructions

### 1. Create a Brevo Account

1. Go to [https://www.brevo.com](https://www.brevo.com)
2. Sign up for a **free account** (no credit card required)
3. Verify your email address

### 2. Get Your API Key

1. Log in to Brevo dashboard
2. Go to **Settings** → **API Keys**
3. Click **Generate a new API key**
4. Copy the API key

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# Brevo Configuration
BREVO_API_KEY=your_brevo_api_key_here
EMAIL_FROM=noreply@restoh.com
EMAIL_FROM_NAME=RestOh Restaurant

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

### 4. Verify Setup

Test the email system:

```bash
npm start
# Server should start without errors
```

## Email Types

### 1. Email Verification (Transactional)

**Sent when:** User registers a new account

**Endpoint:** Automatic on registration

**Features:**
- Secure token (32 bytes, hex)
- 24-hour expiration
- One-time use
- Resend capability

**User Flow:**
1. User registers → Email sent automatically
2. User clicks verification link in email
3. Email verified → `isEmailVerified = true`

**API Endpoints:**
```
GET  /api/email/verify/:token          # Verify email with token
POST /api/email/resend-verification    # Resend verification email
```

### 2. Password Reset (Transactional)

**Sent when:** User requests password reset

**Features:**
- Secure token (32 bytes, hex)
- 30-minute expiration
- One-time use
- Security best practices (doesn't reveal if email exists)

**User Flow:**
1. User requests password reset
2. Email sent with reset link
3. User clicks link and sets new password
4. Token marked as used

**API Endpoints:**
```
POST /api/email/forgot-password        # Request password reset
POST /api/email/reset-password/:token  # Reset password with token
```

### 3. Newsletter (Marketing)

**Sent to:** Users who opted in for newsletter (`notifications.newsletter = true`)

**Features:**
- Bulk sending (with 100ms delay between emails)
- Only verified and active users
- Unsubscribe link included
- Success/failure tracking

**Admin Flow:**
1. Admin composes newsletter
2. Admin sends via POST request
3. System finds all newsletter subscribers
4. Emails sent in bulk with rate limiting

**API Endpoints:**
```
POST /api/newsletter/send              # Send newsletter (Admin only)
GET  /api/newsletter/stats             # Get subscriber stats (Admin only)
GET  /api/newsletter/unsubscribe/newsletter/:userId  # Unsubscribe link (Public)
```

**Example Request:**
```javascript
POST /api/newsletter/send
{
  "subject": "RestOh Monthly Update - March 2025",
  "content": "<h2>What's New This Month</h2><p>Check out our new menu items...</p>"
}
```

### 4. Promotions (Marketing)

**Sent to:** Users who opted in for promotions (`notifications.promotions = true`)

**Features:**
- Bulk sending with rate limiting
- Only verified and active users
- Unsubscribe link included
- Limited-time offer badges

**API Endpoints:**
```
POST /api/newsletter/promotion         # Send promotion (Admin only)
GET  /api/newsletter/unsubscribe/promotions/:userId  # Unsubscribe link (Public)
```

**Example Request:**
```javascript
POST /api/newsletter/promotion
{
  "subject": "🎉 20% Off All Orders This Weekend!",
  "promotionContent": "<h3>Special Weekend Offer</h3><p>Use code: WEEKEND20</p>"
}
```

## User Notification Preferences

Users can control email preferences in their profile:

```javascript
notifications: {
  newsletter: true,   // Opt-in/out for newsletter
  promotions: true    // Opt-in/out for promotions
}
```

**Update via:**
```
PUT /api/auth/profile
{
  "notifications": {
    "newsletter": false,
    "promotions": true
  }
}
```

## Rate Limiting

To avoid hitting Brevo's limits (300 emails/day):

- **Bulk emails:** 100ms delay between each email
- **Transactional emails:** No delay (high priority)
- **Daily limit:** Monitored by Brevo

## Security Best Practices

### Token Generation
- Uses `crypto.randomBytes(32)` for secure random tokens
- Tokens are unique and unpredictable
- Short expiration times (30 min for password reset, 24h for verification)

### Privacy
- Password reset doesn't reveal if email exists
- Verification tokens automatically deleted after use
- Expired tokens automatically cleaned up by MongoDB TTL index

### Email Content
- All templates include unsubscribe links (marketing emails)
- Clear sender identification
- Professional branding

## Monitoring & Debugging

### Logs

The system logs all email operations:

```
✓ Email sent to user@example.com: Verify Your Email
✗ Email sending failed: Invalid API key
✓ Verification email sent to user@example.com
```

### Success Tracking

Newsletter/promotion endpoints return detailed results:

```json
{
  "success": true,
  "data": {
    "totalSubscribers": 150,
    "sent": 148,
    "failed": 2,
    "errors": [
      {
        "email": "invalid@email",
        "error": "Invalid email address"
      }
    ]
  }
}
```

## Testing

### Development Testing

Use **Mailtrap** or **Ethereal** for testing without sending real emails:

```javascript
// In development, you can swap Brevo with a test service
if (process.env.NODE_ENV === 'development') {
  // Use test email service
}
```

### Testing Checklist

- [ ] Registration sends verification email
- [ ] Verification link works and verifies email
- [ ] Password reset sends email
- [ ] Password reset link works and resets password
- [ ] Newsletter sent only to opted-in users
- [ ] Promotions sent only to opted-in users
- [ ] Unsubscribe links work
- [ ] Expired tokens are rejected

## Cost & Limits

### Free Tier (Current)
- **300 emails/day** (9,000/month)
- Unlimited contacts
- No credit card required
- All features included

### If you exceed free tier:
- **Lite Plan:** $25/month for 20,000 emails
- **Essential Plan:** $39/month for 40,000 emails
- Or switch to AWS SES: $1 per 1,000 emails

## Troubleshooting

### Email not sending

1. Check `BREVO_API_KEY` in `.env`
2. Check Brevo dashboard for errors
3. Check server logs for error messages
4. Verify email address format

### Verification link not working

1. Check token hasn't expired (24h limit)
2. Check `FRONTEND_URL` is correct
3. Token is one-time use only

### Newsletter not reaching users

1. Verify users have `isEmailVerified = true`
2. Verify users have `notifications.newsletter = true`
3. Verify users have `isActive = true`
4. Check daily email limit (300/day)

## Future Enhancements

- [ ] Email queue system (Bull/BullMQ) for high volume
- [ ] Email templates with MJML for better rendering
- [ ] A/B testing for marketing emails
- [ ] Email analytics dashboard
- [ ] Scheduled newsletter sending
- [ ] Email bounce handling
- [ ] Separate subdomain for transactional vs marketing

## Support

For issues with:
- **Brevo service:** [https://help.brevo.com](https://help.brevo.com)
- **RestOh email system:** Check server logs and this documentation
