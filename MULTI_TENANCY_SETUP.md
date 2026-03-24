# Ancora - Landing Page & Multi-Tenancy Setup

## Overview
Successfully created a landing page and initialized multi-tenant architecture for Ancora. The app now supports:
- **www.domain.com** - Marketing landing page (public)
- **app.domain.com** - Main SaaS application (authenticated)  
- **admin.domain.com** - System administration panel (ADMIN role only)
- **Invitation-based signup** - Initial onboarding via email invitations (with self-signup planned for future)

---

## What Was Built

### 1. **Landing Page** (`/landing`)
- Responsive homepage with hero section
- Feature showcase with 6 key product features
- 3-tier pricing page
- Call-to-action buttons linking to signup/login
- Professional navigation and footer
- **Files**: `src/app/landing/layout.tsx`, `src/app/landing/page.tsx`

### 2. **Subdomain Routing** 
- **Middleware** (`src/middleware.ts`): 
  - Detects subdomain from Host header
  - Routes requests based on subdomain (`www` → landing, `app` → dashboard, `admin` → admin panel)
  - Enforces role-based access control at edge level
  - Maintains security headers and CSRF protection

**Example requests:**
```
www.domain.com/          → Redirects to /landing
app.domain.com/          → Requires auth, shows dashboard/portal
admin.domain.com/        → Requires ADMIN role
localhost:3000/          → Defaults to landing page
localhost:3000/dashboard → Existing dashboard (works as before)
```

### 3. **Admin Dashboard** (`/admin`)
- System-wide administration area
- Views for:
  - Tenant management
  - User monitoring  
  - System settings
- Protected by ADMIN role check
- **Files**: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`

### 4. **Signup & Tenant Creation** (`/auth/landing/setup`)
- Self-service tenant and user creation
- Creates new tenant with unique slug from company name
- Sets up admin user with encrypted password (bcrypt)
- Two-step flow: form entry → success confirmation
- **File**: `src/app/auth/landing/setup/page.tsx`

### 5. **Invitation System** (`/auth/landing/accept-invite`)
- Verify invitation link with expiration
- Accept invitations to join existing tenants
- Role assignment from invitation
- **File**: `src/app/auth/landing/accept-invite/page.tsx`

### 6. **Enhanced Sign In** (`/auth/signin`)
- Improved UI with card-based design
- Error messaging with visual indicators
- Loading states
- Callback URL support for post-login redirects
- **File**: `src/app/auth/signin/page.tsx`

---

## Database Changes

### New Table: `tenant_invitations`
Tracks tenant invitations for onboarding:

```typescript
model TenantInvitation {
  id               String   @id @default(cuid())
  tenantId         String   @map("tenant_id")
  email            String
  role             UserRole @default(STAFF)
  invitedBy        String?  @map("invited_by") // User ID
  invitationToken  String   @unique @map("invitation_token")
  expiresAt        DateTime @map("expires_at") @db.Timestamptz
  acceptedAt       DateTime? @map("accepted_at") @db.Timestamptz
  acceptedUserId   String?  @map("accepted_user_id") // User ID of who accepted
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz

  tenant          Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invitedByUser   User?  @relation("TenantInvitationCreator", ...)
  acceptedByUser  User?  @relation("TenantInvitationAcceptor", ...)

  @@unique([tenantId, email], map: "tenantId_email")
  @@index([tenantId])
  @@index([invitationToken])
  @@map("tenant_invitations")
}
```

Updated relations in `Tenant` and `User` models to support invitations.

---

## API Endpoints

### `/api/auth/setup` (POST)
**Create new tenant and admin user**
```json
{
  "companyName": "ACME Corp",
  "contactName": "John Doe",
  "email": "john@acme.com",
  "password": "SecurePassword123"
}
```
Returns: Newly created tenant and user
Status: 201 (success), 400 (validation error)

### `/api/auth/tenants` (GET)
**Get all tenants for current user**
Returns: Array of tenants
Status: 200 (success), 401 (unauthorized)

### `/api/auth/invitations/[token]` (GET)
**Verify and retrieve invitation details**
Returns: Invitation object with tenant info
Status: 200 (valid), 404 (not found), 410 (expired), 400 (already accepted)

---

## Multi-Tenancy Foundation

Everything is scoped by `tenantId`:
- ✅ All queries filter by tenant
- ✅ All tables have `tenant_id` foreign key with CASCADE delete
- ✅ User sessions include `tenantId`
- ✅ Authorization enforced server-side

**Pattern used throughout:**
```typescript
const resource = await prisma.client.findUnique({
  where: { 
    id: clientId, 
    tenantId: session.user.tenantId // Always verify tenant ownership
  }
})
```

---

## Local Testing Guide

### Test Landing Page
```
http://localhost:3000/              # Redirects to /landing
http://localhost:3000/landing       # Marketing page
```

### Create New Tenant
```
http://localhost:3000/auth/landing/setup
```
Fill in company details to create account

### Sign In
```
http://localhost:3000/auth/signin
```
Use credentials just created

### Admin Dashboard (if user role is ADMIN)
```
http://localhost:3000/admin
```

### Test Subdomain Routing (Production/Staging)
```
# Add to /etc/hosts for local testing:
127.0.0.1 app.localhost.local
127.0.0.1 admin.localhost.local
127.0.0.1 www.localhost.local

# Then visit:
http://www.localhost.local:3000     # Landing page
http://app.localhost.local:3000     # App (requires auth)
http://admin.localhost.local:3000   # Admin (requires ADMIN role)
```

---

## Next Steps (Recommended)

1. **Email Integration**
   - Send welcome emails on signup
   - Send invitation emails with token links
   - Use Resend or Azure Communication Services

2. **Tenant Invitation Flow**
   - Admin API to create invitations for team members
   - Batch invite functionality
   - Invitation expiration/resend options

3. **Multi-Domain Setup**
   - Configure DNS for production domains
   - Set up wildcard SSL certificates
   - Configure per-environment in `.env`

4. **Client Portal Invitations**
   - Allow admins to invite client users to portal
   - Different invitation flow for CLIENT role

5. **Onboarding Wizard**
   - Post-signup setup for retainer templates
   - Initial data entry (clients, retainers)
   - Feature walkthrough

6. **Self-Service Signup** (future)
   - Transition from invitation-only to open signing
   - Email verification step
   - OAuth provider options (Google, GitHub, etc.)

---

## File Structure Summary

```
src/
├── app/
│   ├── landing/              # Public landing page
│   │   ├── layout.tsx        # Landing layout (nav, footer)
│   │   ├── page.tsx          # Hero + features + pricing
│   │   └── components/
│   ├── auth/
│   │   ├── signin/page.tsx   # Enhanced signin form
│   │   └── landing/
│   │       ├── setup/        # Tenant creation flow
│   │       └── accept-invite/ # Accept invitation flow
│   ├── admin/                # System admin area
│   │   ├── layout.tsx        # Admin layout with sidebar
│   │   ├── page.tsx          # Admin dashboard
│   │   └── auth/
│   ├── api/auth/
│   │   ├── setup/route.ts    # Create tenant + user
│   │   ├── tenants/route.ts  # List user tenants
│   │   └── invitations/[token]/route.ts # Verify invitation
│   └── ...existing routes (dashboard, portal, etc.)
├── middleware.ts            # Subdomain routing + auth
├── lib/
│   ├── auth.ts             # NextAuth config (unchanged)
│   └── ...
└── db/
    └── index.ts            # Prisma Client

prisma/
└── schema.prisma           # Added TenantInvitation model
```

---

## Security Notes

- ✅ Passwords hashed with bcrypt (12 salt rounds)
- ✅ Invitations use cryptographically secure tokens
- ✅ Role-based access control at edge + server level
- ✅ Tenant scoping enforced on all queries
- ✅ CSRF protection maintained
- ✅ Security headers on all responses

---

## Architecture Diagram

```
User Request
    ↓
Middleware (getSubdomain)
    ├→ www/root    → /landing (public)
    ├→ app         → /dashboard|/portal (requires auth)
    └→ admin       → /admin (requires ADMIN role)
    ↓
Edge Auth Check (JWT)
    ├→ Authorized  → Route handler
    └→ Unauthorized → Redirect to /auth/signin
    ↓
Server Auth Check + Tenant Validation
    ├→ Verified    → Render page/API
    └→ Unauthorized → 401/403
```

---

## Configuration

No additional environment variables needed. Existing `.env` contains all required settings.

The app will auto-detect protocol/domain from request headers in production.

---

## Status: ✅ Complete

All core features implemented:
- ✅ Landing page with responsive design
- ✅ Subdomain routing (www, app, admin)
- ✅ Multi-tenant foundation verified
- ✅ Signup flow with tenant creation
- ✅ Invitation system scaffolded
- ✅ Admin dashboard skeleton
- ✅ Database schema updated
- ✅ No TypeScript errors
- ✅ Zero breaking changes to existing code
