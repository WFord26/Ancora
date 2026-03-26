# Email Integration & Client Portal Invitations

## Overview
Fully integrated email system using Resend for sending transactional emails and a complete client portal invitation workflow.

---

## What Was Built

### 1. **Email Integration** ✅
- **Provider**: Resend (already in dependencies)
- **Location**: `src/lib/email.ts`
- **Features**:
  - Lazy-loaded Resend client (prevents build errors)
  - Fallback to console.log in dev mode (if no API key)
  - Beautiful HTML email templates with responsive design
  - Type-safe email sending functions

### 2. **Email Templates Added**

#### a) **Welcome Email** (`sendWelcomeEmail`)
Sent when new tenant/user signs up
- Features overview
- Quick action buttons
- Support resources link
- Branded header/footer

#### b) **Team Invitation Email** (`sendTeamInvitationEmail`)
Sent when inviting colleagues to tenant
- Personal greeting from inviter
- 7-day expiring token link
- Clear CTA to accept invitation
- Fallback to contact inviter

#### c) **Client Portal Invitation Email** (`sendClientInvitationEmail`)
Sent when inviting clients to view retainers
- Benefits of portal access
- Direct access link with token
- Account creation instructions
- Contact info for questions

---

## API Endpoints

### **Team Invitations**

#### `POST /api/invitations/send`
**Invite team member to tenant**

```json
{
  "email": "colleague@company.com",
  "role": "STAFF"  // or "ADMIN"
}
```

Returns:
```json
{
  "message": "Invitation sent successfully",
  "invitation": {
    "id": "cuid",
    "email": "colleague@company.com",
    "role": "STAFF"
  }
}
```

**Authorization**: ADMIN or STAFF role required
**Status**: 201 (created), 400 (validation), 401 (unauthorized), 403 (forbidden)

---

### **Client Invitations**

#### `POST /api/clients/[clientId]/invite`
**Invite client to access retainer portal**

```json
{
  "email": "client@acme.com",
  "clientName": "ACME Corp"  // optional
}
```

Returns:
```json
{
  "message": "Client invitation sent successfully",
  "invitation": {
    "id": "cuid",
    "email": "client@acme.com"
  }
}
```

**Authorization**: ADMIN or STAFF role required
**Status**: 201 (created), 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (client not found)

#### `GET /api/auth/client-invitations/[token]`
**Verify client invitation**

Returns:
```json
{
  "invitation": {
    "id": "cuid",
    "email": "client@acme.com",
    "tenantId": "...",
    "clientId": "...",
    "expiresAt": "2026-03-29T...",
    "tenant": { "id": "...", "name": "..." },
    "client": { "id": "...", "companyName": "..." }
  }
}
```

**Status**: 200 (valid), 400 (accepted/inactive), 404 (not found), 410 (expired)

#### `POST /api/auth/client-invitations/[token]/accept`
**Accept client invitation & create/link user**

Returns:
```json
{
  "message": "Invitation accepted successfully",
  "user": {
    "id": "cuid",
    "email": "client@acme.com",
    "role": "CLIENT"
  }
}
```

**Effects**:
- If CLIENT user with email doesn't exist: Creates new CLIENT user
- If user exists and is CLIENT: Links them to invitation
- If user exists with different role: Returns 400 error
- Marks invitation as accepted with timestamp

**Status**: 200 (success), 400 (validation/conflict), 404 (not found), 410 (expired)

---

## Database Schema

### New `client_invitations` Table
```sql
CREATE TABLE client_invitations (
  id                 VARCHAR(255) PRIMARY KEY,
  tenant_id          VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id          VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email              VARCHAR(255) NOT NULL,
  invited_by         VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  invitation_token   VARCHAR(255) UNIQUE NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  accepted_at        TIMESTAMPTZ,
  accepted_user_id   VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(client_id, email),
  INDEX (tenant_id),
  INDEX (client_id),
  INDEX (invitation_token)
)
```

### Updated Relations
- **User** ← Has "created" and "accepted" ClientInvitations
- **Tenant** ← Has many ClientInvitations
- **Client** ← Has many ClientInvitations

---

## Flow Diagrams

### Team Invitation Flow
```
Admin/Staff → POST /api/invitations/send
     ↓
Validate email, create invitation token
     ↓
Send email with 7-day token link
     ↓
User clicks link → GET /api/auth/invitations/[token]
     ↓
Show acceptance page
     ↓
User clicks Accept → /auth/landing/accept-invite/page.tsx
     ↓
Creates user or links existing user to tenant
     ↓
Redirect to dashboard
```

### Client Invitation Flow
```
Admin/Staff → POST /api/clients/[clientId]/invite
     ↓
Validate client, create invitation token
     ↓
Send email with 7-day token link
     ↓
Client clicks link → GET /api/auth/client-invitations/[token]
     ↓
Show acceptance page
     ↓
Client clicks Accept → /auth/landing/accept-client-invite/page.tsx
     ↓
Creates CLIENT user or links existing user
     ↓
Redirect to portal
```

### Welcome Email Flow
```
POST /api/auth/setup (user creates account)
     ↓
Tenant + User created
     ↓
sendWelcomeEmail() called
     ↓
Beautiful branded email sent
     ↓
Contains link to dashboard
```

---

## Email Configuration

### Environment Variables Required
```bash
RESEND_API_KEY=re_xxx...              # Get from https://resend.com
EMAIL_FROM="Ancora <noreply@ancora.app>"  # Optional, defaults to shown value
NEXT_PUBLIC_APP_URL=https://app.domain.com  # Optional, used in email links
```

### Local Development
- If `RESEND_API_KEY` is not set: Emails are logged to console
- Check browser console or terminal for email content
- No actual emails are sent

### Production
- Set `RESEND_API_KEY` in deployment environment
- Emails are sent via Resend API
- Email domain should be verified in Resend dashboard

---

## File Structure

```
src/
├── lib/
│   └── email.ts                      # Core email functions & templates
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── setup/route.ts       # Updated: sends welcome email
│   │   │   ├── invitations/[token]/route.ts   # Team invitation verification
│   │   │   └── client-invitations/
│   │   │       └── [token]/
│   │   │           ├── route.ts     # Verify client invitation
│   │   │           └── accept/route.ts # Accept client invitation
│   │   ├── invitations/
│   │   │   └── send/route.ts        # Send team invitations
│   │   └── clients/
│   │       └── [clientId]/
│   │           └── invite/route.ts  # Send client invitations
│   └── auth/
│       └── landing/
│           ├── accept-client-invite/page.tsx  # Client invite acceptance UI
│           └── setup/page.tsx        # Updated: sends welcome email
│
prisma/
└── schema.prisma                     # Added ClientInvitation model
```

---

## Testing Guide

### Test Welcome Email
1. Go to `http://localhost:3000/auth/landing/setup`
2. Fill in and submit form
3. Check terminal/console for email (dev mode)
4. In production, check Resend dashboard

### Test Team Invitations
1. Sign in as admin/staff
2. Call `POST /api/invitations/send` with email
3. Email sent to that address (check Resend)
4. Click link in email
5. Go to `http://localhost:3000/auth/landing/accept-invite?token=...`
6. Click "Accept Invitation"
7. User created/linked and logs in

### Test Client Invitations
1. Sign in as admin/staff
2. Get a client ID from database or UI
3. Call `POST /api/clients/[clientId]/invite` with client email
4. Email sent (check Resend)
5. Click link in email
6. Go to `http://localhost:3000/auth/landing/accept-client-invite?token=...`
7. Click "Accept Invitation"
8. CLIENT user created
9. Redirect to `/portal`

### Test with cURL
```bash
# Send team invitation
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -d '{"email":"colleague@example.com","role":"STAFF"}'

# Send client invitation
curl -X POST http://localhost:3000/api/clients/123abc/invite \
  -H "Content-Type: application/json" \
  -d '{"email":"client@acme.com","clientName":"ACME"}'

# Verify invitation
curl http://localhost:3000/api/auth/client-invitations/token123abc

# Accept invitation
curl -X POST http://localhost:3000/api/auth/client-invitations/token123abc/accept
```

---

## Email Design Details

### Visual Elements
- **Color scheme**: Blue (#18181b) + accent gradients
- **Typography**: System font stack for performance
- **Spacing**: Generous margins for readability
- **Buttons**: Clear primary action with contrasting color
- **Responsive**: Works on mobile, tablet, desktop

### Template Structure
```
Container (600px max)
  ├── Logo/Header
  ├── Main Content
  │   ├── Greeting
  │   ├── Body text
  │   ├── Features/Details (if applicable)
  │   └── CTA Button
  └── Footer (copyright + disclaimer)
```

### Fallback Text
All emails include plain text alternatives for clients that don't support HTML

---

## Security Considerations

✅ **Implemented:**
- Invitation tokens are 64-character random hex (cryptographically secure)
- Tokens stored as database unique constraint
- All endpoints check authorization
- Tenant scoping enforced
- Email validation (no injection)
- Rate limiting can be applied (see `/src/lib/rate-limit.ts`)

⚠️ **Recommendations:**
- Set `RESEND_API_KEY` with restricted API key (Resend supports scopes)
- Monitor Resend for bounce/complaint rates
- Implement email bounce handling (optional future enhancement)
- Consider rate limiting on /api/invitations/send (add middleware)

---

## Telemetry & Monitoring

### Logging
- Email send attempts logged to console
- Errors logged with full context
- Check for error messages in logs when emails fail

### Resend Dashboard
- Track email opens and clicks (optional, requires tracking pixel)
- Monitor bounce/complaint rates
- View delivery status per recipient
- Check API usage and rate limits

---

## Future Enhancements

1. **Email bounce handling**
   - Mark invalid emails in database
   - Implement webhook from Resend for bounces

2. **Email templates UI**
   - Admin interface to customize email templates
   - Brand colors and logos

3. **Invitation reminders**
   - Automatic reminder 3 days before expiry
   - Resend link option

4. **Batch invitations**
   - CSV upload for multiple team/client invites
   - Bulk send with progress tracking

5. **Advanced segments**
   - Segment users by tenant/client
   - Send targeted announcements

6. **Unsubscribe management**
   - Email preferences/notification settings
   - Unsubscribe links in all emails

---

## Environment Variables Checklist

```bash
# Required
RESEND_API_KEY=re_xxx...

# Optional
EMAIL_FROM="Ancora <noreply@ancora.app>"
NEXT_PUBLIC_APP_URL=https://app.domain.com
```

---

## Status: ✅ Complete

All email integration and client invitation features fully implemented:
- ✅ Resend email provider configured
- ✅ Welcome email on signup
- ✅ Team member invitations
- ✅ Client portal invitations
- ✅ Email templates with responsive design
- ✅ Invitation acceptance flows
- ✅ Database schema & relations
- ✅ API endpoints with authorization
- ✅ TypeScript type safety
- ✅ Zero errors

**Next steps**: Deploy with RESEND_API_KEY and test end-to-end invitations
