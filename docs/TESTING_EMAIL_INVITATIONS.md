# Email & Invitations Testing Guide

Complete end-to-end testing guide for Ancora's email integration and invitation system.

---

## Quick Start: Local Testing

### Prerequisites
```bash
# Ensure dev server is running
npm run dev  # Should be running on http://localhost:3000

# Optional: Have Prisma Studio open for real-time database viewing
npm run db:studio  # Opens http://localhost:5555
```

### Dev Mode Email Sending
When `RESEND_API_KEY` is not set:
- Emails logged to **console** (not actually sent)
- Terminal output shows complete email HTML
- Perfect for local testing without API key

---

## Test 1: Welcome Email on Signup

### What happens:
1. New user creates account via `POST /api/auth/setup`
2. Tenant + User created in database
3. Welcome email automatically sent

### Steps to test:

**Via Web UI:**
```
1. Go to http://localhost:3000/auth/landing/setup
2. Fill in form:
   - Contact Name: "Test User"
   - Company Name: "Test Company"
   - Email: "test@example.local"
   - Password: Password123!
3. Click "Create Account"
4. Watch terminal for email output
```

**Via cURL:**
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "Test User",
    "companyName": "Test Company",
    "email": "test@example.local",
    "password": "Password123!"
  }'
```

### Expected Result:
```
✓ Tenant created in database
✓ User created with ADMIN role
✓ Email logged to console with HTML content
✓ Email contains dashboard link
✓ User redirected to dashboard login
```

### Check in Prisma Studio:
```
1. Open http://localhost:5555
2. Navigate to Tenant table
3. Verify new tenant exists with correct company name
4. Navigate to User table
5. Verify admin user exists with correct email/name
```

---

## Test 2: Team Member Invitation

### What happens:
1. Admin sends invitation via `POST /api/invitations/send`
2. TenantInvitation created in database
3. Invitation email sent with 7-day expiring token
4. Invitee clicks link and accepts

### Steps to test:

**Step 1: Sign in as Admin**
```bash
# Use credentials from Test 1 signup or existing admin account
# Go to: http://localhost:3000/auth/signin
# Email: test@example.local
# Password: Password123!
```

**Step 2: Get your User Data (for verification)**
```bash
# Can view in Prisma Studio at http://localhost:5555
# Check: sessions table to verify login token
# Check: users table for tenantId
```

**Step 3: Send Invitation (via API)**
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "colleague@example.local",
    "role": "STAFF"
  }'
```

**Step 3b: Get Session Token for cURL**
```bash
# From Prisma Studio:
# 1. Click "sessions" table under User
# 2. Find your session record
# 3. Copy the "sessionToken" value
# 4. Use in -H "Cookie" header above

# Or check browser:
# 1. Open DevTools → Application → Cookies
# 2. Find "next-auth.jwt" cookie
# 3. Copy the value
```

**Step 4: Check Email Output**
```
Terminal shows:
  From: Ancora <noreply@ancora.app>
  To: colleague@example.local
  Subject: You're invited to [Tenant Name]
  
Content includes:
  - Personal greeting
  - Company mention
  - 7-day expiration warning
  - Accept button with link
  - Token in URL
```

**Step 5: Copy Invitation Token from Email**
```
HTML in terminal shows URL like:
  https://localhost:3000/auth/landing/accept-invite?token=abc123...def456
  
Copy the token value: abc123...def456
```

**Step 6: Accept Invitation**
```bash
# Via browser (recommended):
http://localhost:3000/auth/landing/accept-invite?token=abc123def456
# Should show invitation details + accept button
# Click "Accept" to confirm

# Via API:
curl -X POST http://localhost:3000/api/auth/invitations/abc123def456/accept \
  -H "Content-Type: application/json" \
  -d '{
    "email": "colleague@example.local",
    "password": "NewPassword123!"
  }'
```

### Expected Result:
```
✓ API returns 201 with invitation
✓ Email logged to console
✓ TenantInvitation created in database
✓ Invitation page shows "Pending Acceptance"
✓ Accept button functional
✓ New user created with STAFF role
✓ User added to same tenant
✓ User can now login
```

### Verify in Database:
```
Prisma Studio → tenantinvitations table:
  - invitationToken: matches token from email
  - email: colleague@example.local
  - role: STAFF
  - expiresAt: 7 days from now
  - acceptedAt: null (until accepted)

After acceptance:
  - acceptedAt: now (timestamp)
  - acceptedUserId: new user's ID

Users table:
  - New user with email: colleague@example.local
  - role: STAFF
  - tenantId: same as inviter
```

---

## Test 3: Client Invitation

### What happens:
1. Admin sends client invitation via `POST /api/clients/[clientId]/invite`
2. ClientInvitation created in database
3. Client invitation email sent with 7-day expiring token
4. Client clicks link and accepts → CLIENT user created

### Steps to test:

**Step 1: Ensure signed in as Admin**
```
http://localhost:3000/auth/signin
(use credentials from Test 1)
```

**Step 2: Get or Create a Client**

Option A: Create via API:
```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "companyName": "ACME Corp",
    "contactName": "John Doe",
    "contactEmail": "john@acme.local",
    "address": {
      "street": "123 Main St",
      "city": "Denver",
      "state": "CO",
      "postalCode": "80203",
      "country": "USA"
    }
  }'
```

Option B: View existing clients in Prisma Studio:
```bash
npm run db:studio
# Navigate to Client table
# Copy any client's ID
```

**Step 3: Send Client Invitation**
```bash
# Replace CLIENT_ID with actual ID from Step 2
curl -X POST http://localhost:3000/api/clients/CLIENT_ID/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "client-contact@acme.local",
    "clientName": "ACME Corp"
  }'
```

**Step 4: Check Email Output**
```
Terminal shows:
  From: Ancora <noreply@ancora.app>
  To: client-contact@acme.local
  Subject: Ready to view your retainers?
  
Content includes:
  - Client name (ACME Corp)
  - Portal benefits
  - Accept button with link
  - Token in URL
```

**Step 5: Copy Token and Accept Invitation**
```bash
# Extract token from email URL shown in terminal
# Format: https://localhost:3000/auth/landing/accept-client-invite?token=xyz123

# Via browser:
http://localhost:3000/auth/landing/accept-client-invite?token=xyz123
# Shows invitation details
# Click "Accept Invitation"

# Via API:
curl -X POST http://localhost:3000/api/auth/client-invitations/xyz123/accept \
  -H "Content-Type: application/json"
```

### Expected Result:
```
✓ ClientInvitation created in database
✓ Email sent to client
✓ Invitation page shows client + tenant details
✓ Accept button creates new CLIENT user
✓ New user cannot see ADMIN/STAFF dashboard
✓ New user can access /portal
```

### Verify in Database:
```
Prisma Studio → clientinvitations table:
  - invitationToken: matches token
  - email: client-contact@acme.local
  - clientId: invitation target client
  - expiresAt: 7 days from now
  - acceptedAt: null (until accepted)

After acceptance:
  - acceptedAt: now (timestamp)
  - acceptedUserId: new CLIENT user

Users table:
  - New user: client-contact@acme.local
  - role: CLIENT
  - clientId: linked to invited client
```

---

## Test 4: Invitation Expiration

### What happens:
1. Invitation expires after 7 days
2. Expired invitations cannot be accepted
3. Clear error message shown

### Steps to test:

**Step 1: Create an Invitation**
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "expiry-test@example.local",
    "role": "STAFF"
  }'
```

**Step 2: Manually Expire It (in Prisma Studio)**
```
1. Go to http://localhost:5555
2. Open tenantinvitations or clientinvitations table
3. Click the invitation you just created
4. Edit expiresAt field: set to past date (e.g., 2025-01-01)
5. Save
```

**Step 3: Try to Accept Expired Invitation**
```bash
# Via browser:
http://localhost:3000/auth/landing/accept-invite?token=expiredtoken

# Should show: "Invitation has expired"

# Via API:
curl -X POST http://localhost:3000/api/auth/invitations/expiredtoken/accept
# Should return: 410 Gone with error message
```

### Expected Result:
```
✓ Expired invitation detected
✓ HTTP 410 Gone status returned
✓ Clear error message shown to user
✓ Accept button disabled/hidden
✓ User sees "Request new invitation" link
```

---

## Test 5: Duplicate Invitation Prevention

### What happens:
1. Admin tries to send 2nd invitation to same email
2. System prevents duplicate active invitations
3. Error message returned

### Steps to test:

**Step 1: Send First Invitation**
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "duplicate-test@example.local",
    "role": "STAFF"
  }'
```

**Step 2: Try to Send Second Invitation to Same Email**
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "duplicate-test@example.local",
    "role": "ADMIN"
  }'
```

### Expected Result:
```
✓ First request: 201 Created (success)
✓ Second request: 400 Bad Request
✓ Error message: "Active invitation already exists for this email"
✓ User can only have one active invitation
```

---

## Test 6: Multi-Tenant Isolation

### What happens:
1. Users in one tenant cannot see/access another tenant's users
2. Each tenant has isolated invitation pools
3. Tenant scoping enforced at API level

### Steps to test:

**Step 1: Create First Tenant**
```bash
Session 1: Create account as "Admin One"
- Visit: http://localhost:3000/auth/landing/setup
- Company: "Company One"
- Email: "admin1@company1.local"
```

**Step 2: Create Second Tenant**
```bash
Session 2: Create account as "Admin Two"
- Logout from Session 1 (or use incognito)
- Visit: http://localhost:3000/auth/landing/setup
- Company: "Company Two"
- Email: "admin2@company2.local"
```

**Step 3: Send Invitation from Tenant 1**
```bash
# Log in as admin1@company1.local
# Get their session token
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=SESSION_1_TOKEN" \
  -d '{
    "email": "staff1@example.local",
    "role": "STAFF"
  }'
```

**Step 4: Try to Access from Tenant 2**
```bash
# Log in as admin2@company2.local
# Try to access another tenant's invitations
curl http://localhost:3000/api/invitations \
  -H "Cookie: next-auth.jwt=SESSION_2_TOKEN"

# Should see: empty list (no invitations)
## NOT Tenant 1's invitations
```

### Expected Result:
```
✓ Tenant 1 users only see Tenant 1 invitations
✓ Tenant 2 users only see Tenant 2 invitations
✓ Cross-tenant access returns 404 or empty
✓ Invitations scoped by tenantId in database
```

---

## Test 7: Authorization & Role Checks

### What happens:
1. Only ADMIN and STAFF can send invitations
2. CLIENT users cannot send invitations
3. Non-authenticated users get 401

### Steps to test:

**Step 1: Test Non-Authenticated**
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.local",
    "role": "STAFF"
  }'

# Expected: 401 Unauthorized
```

**Step 2: Create CLIENT User**
```
1. Invite a client (from Test 3)
2. Accept invitation
3. Sign in as that CLIENT user
```

**Step 3: Try Invitation as CLIENT**
```bash
# Logged in as CLIENT user
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=CLIENT_SESSION_TOKEN" \
  -d '{
    "email": "test@example.local",
    "role": "STAFF"
  }'

# Expected: 403 Forbidden
```

### Expected Result:
```
✓ 401: No session
✓ 403: Insufficient permissions (CLIENT role)
✓ 200/201: Success for ADMIN/STAFF
✓ User feedback: Clear error messages
```

---

## Test 8: Email Format Verification

### What happens:
1. Invalid emails rejected
2. Valid emails accepted
3. Email validation on client and server

### Steps to test:

**Step 1: Test Invalid Emails**
```bash
# Missing @
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "notanemail",
    "role": "STAFF"
  }'
# Expected: 400 Bad Request

# Empty string
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "",
    "role": "STAFF"
  }'
# Expected: 400 Bad Request
```

**Step 2: Test Valid Emails**
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "valid.email+tag@example.co.uk",
    "role": "STAFF"
  }'
# Expected: 201 Created
```

### Expected Result:
```
✓ Invalid email: 400 with error message
✓ Valid email: 201 with invitation created
✓ Email validated on frontend and backend
```

---

## Test 9: Email Content Verification

### What happens:
1. Email templates render correctly
2. Links include proper tokens
3. All required information present

### Steps to test:

**Step 1: Send Invitation and Capture Email**
```bash
# Send invitation (see Test 2)
# Watch terminal output for email HTML
```

**Step 2: Check Content Checklist**

Welcome Email Contains:
- ✓ Logo/header
- ✓ Welcome message with company name
- ✓ Dashboard link with URL
- ✓ Features overview
- ✓ Support contact information
- ✓ Footer with copyright

Team Invitation Email Contains:
- ✓ Greeting with inviter name
- ✓ Company name
- ✓ Personal message
- ✓ Accept button with token link
- ✓ 7-day expiration warning
- ✓ Invite link with full URL and token
- ✓ Fallback link in plain text

Client Invitation Email Contains:
- ✓ Client company name
- ✓ Inviter name
- ✓ Portal access benefits
- ✓ Accept button with token link
- ✓ Account creation instructions
- ✓ Support contact information
- ✓ Invite link with full URL and token

**Step 3: Verify Links**
```
1. Copy invitation link from email HTML
2. Format: http://localhost:3000/auth/landing/accept-invite?token=...
3. Paste into browser
4. Should load invitation page with details
```

**Step 4: Test Email in Email Client**
```
1. Optional: Set RESEND_API_KEY to real value
2. Send invitation to real email address
3. Receive email in inbox
4. Check rendering across email clients:
   - Gmail, Outlook, Apple Mail, etc.
5. Verify all links clickable
6. Check text contrast and readability
```

---

## Production Testing Checklist

Before deploying to production:

- [ ] Set `RESEND_API_KEY` to production key
- [ ] Update `EMAIL_FROM` to production domain
- [ ] Update `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Test all email flows end-to-end
- [ ] Verify email domain is DNS configured
- [ ] Test domain verification in Resend dashboard
- [ ] Set up DKIM/SPF/DMARC records
- [ ] Test bounce handling
- [ ] Monitor Resend dashboard for failures
- [ ] Test with actual company email addresses
- [ ] Set up email template customization (future)
- [ ] Configure email notification preferences (future)

---

## Debugging Tips

### Email Not Showing in Console
```bash
# Check that RESEND_API_KEY is NOT set
echo $RESEND_API_KEY  # Should be empty

# Restart dev server
npm run dev

# Try sending invitation again
# Should show in terminal
```

### Database Not Updating
```bash
# Ensure Prisma is up to date
npm run db:generate

# Check database connection
npm run db:studio

# Review migration status
npm run db:push --dry-run
```

### Tokens Not Working
```bash
# Verify token in database matches email
# In Prisma Studio:
# 1. Find invitation record
# 2. Copy invitationToken
# 3. Ensure it matches URL parameter

# Check expiration
# 4. Verify expiresAt > now
```

### Session Issues
```bash
# Clear browser cookies
# DevTools → Application → Cookies → Delete

# Logout completely
# Sign back in

# Get new session token
# Check terminal for auth flow
```

---

## Performance Testing

### Load Testing Email Sending
```bash
# Send 10 invitations sequentially
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/invitations/send \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.jwt=YOUR_SESSION_TOKEN" \
    -d "{\"email\":\"test$i@example.local\",\"role\":\"STAFF\"}"
  sleep 1
done
```

### Monitor Response Times
- Email send should be < 200ms
- Database queries should be < 50ms
- Total API response < 500ms

---

## Summary Checklist

**All Tests Completed?**
- [ ] Test 1: Welcome Email
- [ ] Test 2: Team Member Invitation
- [ ] Test 3: Client Invitation
- [ ] Test 4: Expiration Handling
- [ ] Test 5: Duplicate Prevention
- [ ] Test 6: Multi-Tenant Isolation
- [ ] Test 7: Authorization Checks
- [ ] Test 8: Email Validation
- [ ] Test 9: Email Content

**Ready for Production?**
- [ ] No console errors
- [ ] All API endpoints responding
- [ ] Database migrations applied
- [ ] Email service configured
- [ ] Email templates render correctly
- [ ] Links working end-to-end
- [ ] Multi-tenant scoping verified
- [ ] Authorization enforced
- [ ] Error handling working
- [ ] Performance acceptable

---

## Next Steps

1. **Complete all tests above** ✓
2. **Fix any issues found**
3. **Implement admin UI components** (See CLIENT_PORTAL_INVITATIONS_SETUP.md)
4. **Test UI in browser**
5. **Deploy to staging**
6. **Real-world testing with team**
7. **Deploy to production**

---

Questions? Check:
- `EMAIL_INTEGRATION.md` - Architecture & features
- `CLIENT_PORTAL_INVITATIONS_SETUP.md` - UI implementation
- Copilot instructions in `.github/copilot-instructions.md`

Good luck! 🚀
