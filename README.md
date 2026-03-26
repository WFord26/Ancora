# Ancora - Retainer Management System

IT consulting retainer tracking and billing application built with Next.js 14, TypeScript, Prisma, and PostgreSQL.

## Phase 1 - Foundation ✅

Phase 1 implementation includes:
- ✅ Next.js 14 with App Router and TypeScript (strict mode)
- ✅ Prisma ORM with PostgreSQL 16
- ✅ NextAuth.js authentication with credentials provider
- ✅ Complete database schema with multi-tenant support
- ✅ CRUD API routes for Users and Clients
- ✅ Retainer management (create, update, list)
- ✅ Retainer templates system
- ✅ Time entry tracking with categories
- ✅ Timezone handling utilities
- ✅ Dark/light mode theme support

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+ **OR** Docker Desktop (recommended for local dev)
- Redis (optional, for future BullMQ job queue - included in Docker setup)

## Getting Started

### Option A: Using Docker (Recommended)

Docker Compose simplifies local development by containerizing PostgreSQL and Redis.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env

# 3. Start database services
docker compose up -d

# 4. Verify services are running
docker compose ps

# 5. Initialize database
npm run db:push
npm run db:generate
npm run db:seed

# 6. Start development server
npm run dev
```

See [DOCKER.md](./DOCKER.md) for detailed Docker usage and troubleshooting.

### Option B: Using Local PostgreSQL

If you prefer to install PostgreSQL directly:

### Option B: Using Local PostgreSQL

If you prefer to install PostgreSQL directly:

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
```

Update DATABASE_URL in `.env` with your PostgreSQL credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ancora?schema=public"
```

```bash
# 3. Initialize database
npm run db:push
npm run db:generate
npm run db:seed

# 4. Start development server
npm run dev
```

### Generate NextAuth Secret

For either option, generate a secure `NEXTAUTH_SECRET`:
### Generate NextAuth Secret

For either option, generate a secure `NEXTAUTH_SECRET`:

```bash
# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Linux/Mac
openssl rand -base64 32
```

Add this to your `.env` file:
```env
NEXTAUTH_SECRET="generated-secret-here"
```

## Production Bootstrap

For a fresh production deployment, Ancora now uses a first-time installer instead of an
always-open public signup flow.

1. Deploy the app with an empty production database
2. Start the application in production mode
3. Visit `/auth/landing/setup`
4. Create the first workspace, admin user, and billing timezone
5. Sign in and finish the in-app onboarding wizard

The installer disables itself automatically after the first successful bootstrap. For
local development, continue using `npm run db:seed` or create records manually.

## Database Commands

```bash
npm run db:push        # Push schema changes to database (dev)
npm run db:migrate     # Create a migration (production path)
npm run db:generate    # Regenerate Prisma Client after schema changes
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed database with sample data
```

## Docker Commands (shortcuts)

```bash
npm run docker:up      # Start PostgreSQL and Redis containers
npm run docker:down    # Stop containers
npm run docker:logs    # View container logs
npm run docker:reset   # Reset containers and volumes (deletes data!)
```

See [DOCKER.md](./DOCKER.md) for detailed Docker usage.

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── api/                # API routes (auth, clients, retainers, etc.)
│   │   ├── auth/               # Authentication pages
│   │   ├── dashboard/          # Admin dashboard
│   │   ├── clients/            # Client management pages
│   │   ├── retainers/          # Retainer management pages
│   │   ├── time-entries/       # Time tracking pages
│   │   └── layout.tsx          # Root layout with theme provider
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   └── theme-provider.tsx  # Theme provider
│   ├── lib/                    # Utilities and configurations
│   │   ├── auth.ts             # NextAuth configuration
│   │   ├── timezone.ts         # Timezone conversion utilities
│   │   └── utils.ts            # General utilities
│   ├── db/                     # Database connection
│   │   └── index.ts            # Prisma Client singleton
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts            # Shared types
│   └── integrations/           # Third-party integrations (Stripe, QBO, etc.)
├── prisma/
│   └── schema.prisma           # Database schema
├── public/                     # Static assets
└── tests/                      # Test files (Vitest & Playwright)
```

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in with credentials

### Users
- `GET /api/users` - List all users (paginated)
- `POST /api/users` - Create a new user (admin only)
- `GET /api/users/[id]` - Get user by ID
- `PATCH /api/users/[id]` - Update user

### Clients
- `GET /api/clients` - List all clients (paginated)
- `POST /api/clients` - Create a new client
- `GET /api/clients/[id]` - Get client by ID
- `PATCH /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Soft delete client (admin only)

### Retainers
- `GET /api/retainers` - List all retainers (paginated)
- `POST /api/retainers` - Create a new retainer
- `GET /api/retainers/[id]` - Get retainer by ID
- `PATCH /api/retainers/[id]` - Update retainer

### Templates
- `GET /api/templates` - List all retainer templates
- `POST /api/templates` - Create a new template (admin only)

### Time Entries
- `GET /api/time-entries` - List time entries (filterable, paginated)
- `POST /api/time-entries` - Create a new time entry
- `GET /api/time-entries/[id]` - Get time entry by ID
- `PATCH /api/time-entries/[id]` - Update time entry
- `DELETE /api/time-entries/[id]` - Delete time entry

### Categories
- `GET /api/categories` - List all time categories
- `POST /api/categories` - Create a new category

## Key Features

### Multi-Tenant Architecture
Every database table includes `tenant_id` with proper cascading deletes. All queries are automatically scoped by tenant, even though the app currently supports only a single tenant.

### Timezone Handling
- All timestamps stored in UTC (`timestamptz` in PostgreSQL)
- Conversion to local timezone for display
- Billing period boundaries calculated in retainer's timezone
- Time entry duration calculated from UTC (DST-safe)

### Authentication & Authorization
- JWT-based session strategy with NextAuth.js
- Role-based access control (ADMIN, STAFF, CLIENT)
- Tenant-scoped data access
- Bcrypt password hashing (12 rounds)

### Time Entry System
- Manual time entry with start/end times
- Automatic duration calculation (DST-safe)
- Categories and color coding
- External descriptions (client-visible)
- Internal notes (staff-only)
- Billable/non-billable toggle

### Retainer Management
- Flexible retainer configurations
- Retainer templates for common plans
- Automatic period creation
- Usage tracking per period
- Rollover hour support (with caps and expiration)

## Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e
```

## Security Best Practices

- ✅ Password hashing with bcrypt (12+ rounds)
- ✅ JWT-based sessions with secure httpOnly cookies
- ✅ Role-based access control on all API routes
- ✅ Tenant isolation (every query scoped by tenantId)
- ✅ Input validation with Zod schemas
- ✅ SQL injection protection (Prisma ORM)
- ✅ XSS prevention (React's automatic escaping)
- ✅ CSRF protection (Next.js Server Actions)

## Next Steps (Phase 2)

Phase 2 will focus on billing core functionality:
- Monthly billing cycle automation (BullMQ + Redis)
- Overage tier calculation engine
- Invoice generation with PDF export
- Stripe integration (customers, payment links, autopay)
- Rollover processing logic

## Documentation

- [Architecture.md](./Architecture.md) - Complete system architecture and design
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) - Development guidelines

## License

This repository is currently licensed under Apache 2.0. See [LICENSE](./LICENSE).

---

Built with ❤️ for IT consulting teams
