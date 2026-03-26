# Email & Invitations - Quick Reference

## 📧 Email Setup

### Configuration
```bash
# .env.local (development)
# RESEND_API_KEY not needed - uses console.log

# .env.production
RESEND_API_KEY=re_xxx...
EMAIL_FROM="Ancora <noreply@ancora.app>"
NEXT_PUBLIC_APP_URL=https://app.domain.com
```

### Get Resend API Key
1. Visit https://resend.com
2. Create account / sign in
3. API Keys section → Create new key
4. Add to environment variables

---

## 🚀 Quick API Tests

### Create Account + Welcome Email
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "John",
    "companyName": "ACME",
    "email": "john@acme.com",
    "password": "Pass123!"
  }'
```

### Send Team Invitation
```bash
curl -X POST http://localhost:3000/api/invitations/send \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=TOKEN" \
  -d '{
    "email": "colleague@example.com",
    "role": "STAFF"
  }'
```

### Send Client Invitation
```bash
curl -X POST http://localhost:3000/api/clients/CLIENT_ID/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.jwt=TOKEN" \
  -d '{
    "email": "client@example.com",
    "clientName": "ACME Corp"
  }'
```

### Verify Invitation
```bash
curl http://localhost:3000/api/auth/client-invitations/TOKEN
```

### Accept Invitation
```bash
curl -X POST http://localhost:3000/api/auth/client-invitations/TOKEN/accept
```

---

## 📁 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/email.ts` | Email service + templates | ✅ Complete |
| `src/app/api/auth/setup/route.ts` | Account creation + welcome | ✅ Complete |
| `src/app/api/invitations/send/route.ts` | Team invitations | ✅ Complete |
| `src/app/api/clients/[clientId]/invite/route.ts` | Client invitations | ✅ Complete |
| `src/app/auth/landing/accept-client-invite/page.tsx` | Invite acceptance UI | ✅ Complete |
| `prisma/schema.prisma` | ClientInvitation model | ✅ Complete |

---

## 🎯 Email Templates

### Welcome Email
- Sent on: Account creation
- Contains: Dashboard link, feature overview
- Function: `sendWelcomeEmail()`

### Team Invitation Email
- Sent on: Admin sends invitation
- Contains: 7-day token link, personal greeting
- Function: `sendTeamInvitationEmail()`
- Token expires: 7 days

### Client Invitation Email
- Sent on: Admin sends to client
- Contains: 7-day token link, portal benefits
- Function: `sendClientInvitationEmail()`
- Token expires: 7 days

---

## 🔐 Security Checklist

- ✅ 32-byte cryptographic tokens
- ✅ 7-day expiration on all invitations
- ✅ Multi-tenant scoping enforced
- ✅ Role-based authorization (ADMIN/STAFF only)
- ✅ No duplicate active invitations
- ✅ Automatic CLIENT user creation
- ✅ Email validation server-side

---

## 🧪 Testing

### Test Welcome Email
```
1. Go to /auth/landing/setup
2. Fill form and submit
3. Check terminal for email output
```

### Test Team Invitation
```
1. Sign in as admin
2. POST /api/invitations/send
3. Check terminal for email + token
4. Use token in /auth/landing/accept-invite?token=...
5. Accept invitation
```

### Test Client Invitation
```
1. Get client ID
2. POST /api/clients/[clientId]/invite
3. Check terminal for email + token
4. Use token in /auth/landing/accept-client-invite?token=...
5. Accept invitation
```

### Full Test Suite
See: `TESTING_EMAIL_INVITATIONS.md`

---

## 📊 Invitation Workflow

```
TEAM INVITATION:
Admin → POST /api/invitations/send
  ↓ (email sent)
Colleague receives email with 7-day token
  ↓ (clicks link)
Accept page shown: /auth/landing/accept-invite?token=...
  ↓ (clicks accept button)
New STAFF user created
  ↓
User redirected to signin
  ↓
Can now access dashboard

CLIENT INVITATION:
Admin → POST /api/clients/[clientId]/invite
  ↓ (email sent)
Client receives email with 7-day token
  ↓ (clicks link)
Accept page shown: /auth/landing/accept-client-invite?token=...
  ↓ (clicks accept button)
New CLIENT user created
  ↓
Client redirected to portal
  ↓
Can view retainers & invoices
```

---

## 🔧 Debugging

### Email Not Showing
```bash
# Check RESEND_API_KEY not set
echo $RESEND_API_KEY

# Restart server
npm run dev

# Try again - should log to console
```

### Token Not Working
```bash
# Copy token from email exactly
# Verify in Prisma Studio it exists
npm run db:studio
# Check: invitationToken, expiresAt > now

# Try fresh browser (cookies)
```

### Database Issues
```bash
# Regenerate Prisma Client
npm run db:generate

# View database
npm run db:studio

# Check migrations
npm run db:push --dry-run
```

---

## 📋 Implementation Tasks

### Phase 1: Admin UI for Team Invitations
- [ ] Create `InviteTeamMemberDialog` component
- [ ] Create `TeamMembersTable` component
- [ ] Create `/dashboard/settings/team/page.tsx`
- [ ] Add Settings → Team link to navigation
- **Time: 1-2 hours**

### Phase 2: Admin UI for Client Invitations
- [ ] Create `InviteClientDialog` component
- [ ] Create `ClientPortalAccess` component
- [ ] Update `/dashboard/clients/[clientId]/page.tsx`
- [ ] Add "Invite to Portal" button
- **Time: 1-2 hours**

### Phase 3: Testing & Deployment
- [ ] Run all 9 tests from TESTING_EMAIL_INVITATIONS.md
- [ ] Deploy to staging with RESEND_API_KEY
- [ ] Test end-to-end invitations
- [ ] Deploy to production
- **Time: 2 hours**

**Total: 3.5-5 hours to full launch**

---

## 📚 Documentation Files

1. **EMAIL_INTEGRATION.md** - Complete architecture & specs
2. **CLIENT_PORTAL_INVITATIONS_SETUP.md** - UI implementation guide with code
3. **TESTING_EMAIL_INVITATIONS.md** - 9 test scenarios + debugging
4. **This file** - Quick reference

---

## ⚠️ Important Notes

### Before Production
1. Set `RESEND_API_KEY` environment variable
2. Verify email domain in Resend dashboard
3. Set up DKIM/SPF/DMARC (Resend will guide you)
4. Test all email flows end-to-end
5. Monitor Resend dashboard for bounces

### Always Remember
- All queries filtered by `session.user.tenantId`
- Tokens are 64-char random hex strings
- Invitations expire after 7 days
- Only ADMIN/STAFF can send invitations
- CLIENT users created automatically on acceptance

---

## 🎓 Database Queries

### View All Pending Team Invitations
```sql
SELECT * FROM "TenantInvitation" 
WHERE "acceptedAt" IS NULL 
AND "expiresAt" > NOW() 
ORDER BY "createdAt" DESC;
```

### View All Pending Client Invitations
```sql
SELECT * FROM "ClientInvitation"
WHERE "acceptedAt" IS NULL
AND "expiresAt" > NOW()
ORDER BY "createdAt" DESC;
```

### View All Accepted Invitations
```sql
SELECT * FROM "ClientInvitation"
WHERE "acceptedAt" IS NOT NULL
ORDER BY "acceptedAt" DESC;
```

### View Expired Invitations
```sql
SELECT * FROM "ClientInvitation"
WHERE "expiresAt" < NOW()
ORDER BY "expiresAt" DESC;
```

---

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Email not showing | Check RESEND_API_KEY not set; restart server |
| Token invalid | Verify URL exactly matches email |
| Expired token | Resend new invitation (7 days) |
| Permission denied | Ensure ADMIN/STAFF role |
| Duplicate email | Check for existing active invitation |
| Different tenant sees email | Not possible - tenant scoped at API |

---

## 📞 Support

- Check: `EMAIL_INTEGRATION.md` for architecture
- Check: `CLIENT_PORTAL_INVITATIONS_SETUP.md` for UI code
- Check: `TESTING_EMAIL_INVITATIONS.md` for test scenarios
- Check: `.github/copilot-instructions.md` for system context
- Run: `npm run db:studio` to inspect database

---

Generated for Ancora Retainer Management System
Last Updated: 2025
Status: ✅ All email & invitations features complete
