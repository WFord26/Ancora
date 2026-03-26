# Quick Start Guide - Ancora Phase 1

## Installation (with Docker)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Generate NEXTAUTH_SECRET (PowerShell):
# [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
# Add to .env

# 3. Start database services
docker compose up -d

# 4. Verify setup
docker compose ps

# 5. Initialize database
npm run db:push
npm run db:generate

# 6. Seed database with sample data
npm run db:seed

# 7. Start development server
npm run dev
```

For production, do not use the public installer during development. Instead, seed local
data with `npm run db:seed`. On a fresh production deployment, visit
`/auth/landing/setup` once to create the first workspace and admin account.

## Installation (without Docker)

If you have PostgreSQL installed locally:

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and generate NEXTAUTH_SECRET

# 3. Verify setup
node scripts/setup-check.js

# 4. Push database schema
npm run db:push

# 5. Generate Prisma Client
npm run db:generate

# 6. Seed database with sample data
npm run db:seed

# 7. Start development server
npm run dev
```

The first-time installer is production-only and locks after the initial bootstrap.

## Default Test Accounts (after seeding)

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`
- Access: Full system access

**Staff Account:**
- Email: `staff@example.com`
- Password: `staff123`
- Access: Time tracking, client/retainer management

## Common Tasks

### Create a Client

```bash
POST /api/clients
Content-Type: application/json

{
  "companyName": "New Client Inc",
  "primaryContactName": "John Doe",
  "email": "john@newclient.com",
  "billingEmail": "billing@newclient.com",
  "phone": "(555) 123-4567",
  "timezone": "America/New_York"
}
```

### Create a Retainer

```bash
POST /api/retainers
Content-Type: application/json

{
  "clientId": "client-id-here",
  "name": "Monthly Support Retainer",
  "includedHours": 20,
  "ratePerHour": 150,
  "rolloverEnabled": true,
  "rolloverCapType": "PERCENTAGE",
  "rolloverCapValue": 50,
  "rolloverExpiryMonths": 3,
  "billingDay": 1,
  "startDate": "2026-03-01"
}
```

### Log Time Entry

```bash
POST /api/time-entries
Content-Type: application/json

{
  "retainerId": "retainer-id-here",
  "categoryId": "category-id-here",
  "startTime": "2026-03-04T09:00:00",
  "endTime": "2026-03-04T11:30:00",
  "timezone": "America/New_York",
  "externalDescription": "Implemented new feature X",
  "internalNotes": "Required custom solution due to legacy system",
  "isBillable": true
}
```

## API Testing with curl

### Sign In
```bash
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### List Clients (requires authentication cookie)
```bash
curl http://localhost:3000/api/clients \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

## Database Management

```bash
# Open Prisma Studio (GUI)
npm run db:studio

# View database in browser
# → http://localhost:5555

# Reset database (WARNING: deletes all data)
npx prisma db push --force-reset
npm run db:seed

# Create a migration
npm run db:migrate
```

## Development Workflow

### Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:generate` to update Prisma Client
3. Run `npm run db:push` to sync database (dev)
4. Restart TypeScript server in your editor if needed

### Testing API Endpoints

Use tools like:
- **Postman**: Import API collection
- **VS Code REST Client**: Use `.http` files
- **curl**: Command line testing
- **Prisma Studio**: Database GUI

### Debugging

```bash
# Check database connection
npx prisma db connect

# View Prisma query logs
# Set in src/db/index.ts:
# log: ['query', 'error', 'warn']

# Check for errors
npm run lint
```

## Project Structure Quick Reference

```
src/
├── app/
│   ├── api/                   # API endpoints
│   │   ├── auth/              # NextAuth routes
│   │   ├── clients/           # Client CRUD
│   │   ├── retainers/         # Retainer CRUD
│   │   ├── time-entries/      # Time entry CRUD
│   │   ├── categories/        # Category CRUD
│   │   ├── users/             # User management
│   │   └── templates/         # Retainer templates
│   ├── auth/                  # Auth pages
│   └── page.tsx               # Home page
├── components/
│   ├── ui/                    # shadcn/ui components
│   └── theme-provider.tsx     # Theme provider
├── lib/
│   ├── auth.ts                # NextAuth config
│   ├── timezone.ts            # Timezone utilities
│   └── utils.ts               # Helper functions
└── db/
    └── index.ts               # Prisma Client
```

## Key Concepts

### Timezone Handling
- All times stored in UTC in database
- Converted to user/client timezone for display
- Billing periods calculated in retainer's timezone
- Duration always calculated from UTC (DST-safe)

### Multi-Tenant Architecture
- Every table has `tenantId`
- All queries automatically scoped by tenant
- Ready for future SaaS expansion

### Time Entry Flow
1. User logs time with local start/end times
2. Server converts to UTC before storing
3. Duration calculated from UTC timestamps
4. Entry assigned to correct retainer period
5. Period usage automatically updated

### Retainer Periods
- Monthly "buckets" for tracking usage
- Automatically created when retainer is created
- Track included hours + rollover
- Calculate overage hours
- Used for billing and invoicing

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Verify DATABASE_URL format
postgres://user:password@localhost:5432/database
```

### Prisma Client Not Found
```bash
npm run db:generate
```

### TypeScript Errors After Schema Change
```bash
npm run db:generate
# Then restart TypeScript server in editor
```

### Port 3000 Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

## Next Steps (Phase 2)

Phase 2 will implement:
- BullMQ job queue for billing automation
- Monthly billing cycle processing
- Overage tier calculation
- Invoice generation with PDF export
- Stripe integration (customers, payments, autopay)
- Email notifications

See [Architecture.md](../Architecture.md) for full roadmap.

---

Questions? Check the main [README.md](../README.md) or [Architecture.md](../Architecture.md) for detailed documentation.
