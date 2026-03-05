# Ancora - Retainer Management System

IT consulting retainer tracking and billing app. Next.js 14 SaaS designed for single-tenant now, architected for multi-tenant pivot.

## Tech Stack

- **Framework**: Next.js 14+ (App Router, Server Actions, TypeScript strict mode)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Auth**: NextAuth.js (credentials provider, JWT strategy)
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix primitives, copied into `src/components/ui/`)
- **Jobs**: BullMQ + Redis for scheduled billing cycles
- **Payments**: Stripe SDK (Checkout, Invoicing, Customer Portal)
- **Testing**: Vitest + Playwright

## Critical Architectural Patterns

### Multi-Tenant Foundation (Single Tenant Today)
Every table includes `tenant_id` with cascading deletes. All queries MUST scope by tenant even though there's currently only one. Example:
```typescript
const clients = await prisma.client.findMany({
  where: { tenantId: session.user.tenantId, isActive: true }
})
```

### Timezone Handling (GOLDEN RULE)
- **Storage**: All timestamps in UTC (`@db.Timestamptz` in Prisma)
- **Display**: Convert to user/client timezone via `date-fns-tz`
- **Billing**: Period boundaries calculated in retainer's timezone, converted to UTC
- **Utilities**: Use `src/lib/timezone.ts` helpers (`toUTC()`, `toLocal()`, `getPeriodBoundary()`)

Example time entry flow:
```typescript
// Client sends: { start: "2025-03-15T09:00", timezone: "America/Denver" }
// Server converts to UTC before storing
const startUtc = toUTC(new Date(input.start), input.timezone)
```

### Database Entity Relationships
Key cascade chain: `Tenant` → `Client` → `Retainer` → `RetainerPeriod` → `TimeEntry`
- `RetainerPeriod` is the monthly "bucket" tracking included hours + rollover
- `TimeEntry.retainerPeriodId` determines which period the time applies to
- Period assignment based on retainer's timezone, not UTC

## Development Workflows

### Common Commands
```bash
npm run dev               # Next.js dev server (port 3000)
npm run db:push           # Push Prisma schema to DB (dev)
npm run db:migrate        # Create migration (production path)
npm run db:studio         # Prisma Studio GUI
npm run db:generate       # Regenerate Prisma Client after schema changes
npm test                  # Run Vitest tests
npm run test:e2e          # Playwright E2E tests
```

### Database Schema Changes
1. Edit `prisma/schema.prisma`
2. Run `npm run db:generate` (required to update Prisma Client types)
3. Dev: `npm run db:push` | Production: `npm run db:migrate`
4. Restart TypeScript server in editor if types not updating

## Project Structure Conventions

```
src/
├── app/                      # Next.js App Router pages
│   ├── (auth)/               # Route group for auth pages
│   ├── api/                  # API routes (NextAuth, REST endpoints)
│   ├── dashboard/            # Admin dashboard
│   ├── portal/               # Client portal pages (separate auth context)
│   └── layout.tsx            # Root layout with theme provider
├── components/
│   ├── ui/                   # shadcn/ui primitives (copied, not imported)
│   ├── dashboard/            # Feature-specific components
│   └── theme-provider.tsx    # Dark/light mode with next-themes
├── lib/
│   ├── auth.ts               # NextAuth config (authOptions)
│   ├── timezone.ts           # Timezone conversion utilities
│   └── utils.ts              # cn() helper + misc utilities
├── db/
│   └── index.ts              # Prisma Client singleton export
├── types/
│   └── index.ts              # Shared TypeScript types
└── integrations/             # QuickBooks/Xero/Stripe integration code
```

## Business Logic Patterns

### Retainer Billing Cycle (Monthly Job)
1. Close `RetainerPeriod` → calculate `used_hours` and `overage_hours` from `TimeEntry` sum
2. Generate `Invoice` with line items: retainer fee + previous month's overage (billed in arrears)
3. Process rollover: `remaining = included_hours + rollover_in - used_hours`
   - Apply cap: `rollover_out = min(remaining, cap_percentage × included_hours)`
   - Set `rollover_expiry_date` (DATE field, evaluated in retainer timezone)
4. Open new `RetainerPeriod` with `rollover_hours_in` from previous period

### Overage Tier Calculation
Tiers stored as JSON array on `Retainer.overage_tiers`:
```json
[
  { "from": 0, "to": 5, "rate": 150 },
  { "from": 5, "to": 10, "rate": 175 },
  { "from": 10, "to": null, "rate": 200 }
]
```
Calculate iteratively: 12 overage hours = (5 × $150) + (5 × $175) + (2 × $200)

### Time Entry Display Rules
- **Admin/Staff**: Show `external_description` + `internal_notes` (full detail)
- **Client Portal**: Show `external_description` only
- **Time Zone**: Convert `start_time`/`end_time` (stored UTC) to viewer's timezone
- **Duration**: Always calculated from UTC timestamps (immune to DST)

## Authentication & Authorization

### Session Structure (JWT)
```typescript
session.user = {
  id: string
  email: string
  name: string
  role: "ADMIN" | "STAFF" | "CLIENT"
  tenantId: string
  timezone: string  // Fallback to tenant.timezone if user.timezone is null
}
```

### Role-Based Access
- **ADMIN**: Full access (settings, integrations, user management)
- **STAFF**: Time entry, client/retainer CRUD, reports
- **CLIENT**: Portal access only (read-only view of their retainer + invoices)

Check in Server Actions/API routes:
```typescript
const session = await getServerSession(authOptions)
if (!session || session.user.role === "CLIENT") throw new Error("Forbidden")
```

## Security Best Practices & SOC2 Compliance

### Authentication & Session Security
- **Password Storage**: Use `bcrypt` with salt rounds ≥12 (see [src/lib/auth.ts](../src/lib/auth.ts))
- **Session Tokens**: JWT-based sessions with secure httpOnly cookies
- **Account Lockout**: Implement after N failed login attempts (planned)
- **MFA**: Azure AD B2C integration planned for SaaS phase

### Data Protection
- **PII Encryption**: Sensitive fields (OAuth tokens) encrypted at rest in `IntegrationConnection`
- **TLS**: All connections use HTTPS (Azure App Service enforces)
- **Database**: PostgreSQL with encrypted connections (`sslmode=require`)
- **Credentials**: Never log passwords, tokens, or API keys; use environment variables only

### Access Control (Principle of Least Privilege)
```typescript
// ALWAYS validate tenantId matches session
const client = await prisma.client.findUnique({
  where: { id: clientId, tenantId: session.user.tenantId }
})
if (!client) throw new Error("Not found") // Don't leak existence

// Role-based authorization at query level
const canEdit = session.user.role === "ADMIN" || session.user.role === "STAFF"
```

### Audit Logging (SOC2 Requirement)
Track these events in `AuditLog` table:
- User authentication (login/logout/failed attempts)
- Data modifications (create/update/delete on Client, Retainer, Invoice)
- Permission changes (role assignments, integration connections)
- Sensitive operations (payment processing, data exports)

Implementation pattern:
```typescript
await prisma.auditLog.create({
  data: {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "CLIENT_UPDATED",
    entityType: "Client",
    entityId: client.id,
    metadata: { changes: diff },
    ipAddress: req.headers['x-forwarded-for'],
    timestamp: new Date()
  }
})
```

### Input Validation & Sanitization
- **Server-Side**: ALWAYS validate with Zod schemas before DB operations
- **SQL Injection**: Prisma ORM provides parameterized queries (safe by default)
- **XSS Prevention**: React escapes by default; use `dangerouslySetInnerHTML` only with sanitized HTML
- **CSRF**: Next.js Server Actions include automatic CSRF protection

### Data Retention & Privacy
- **Soft Deletes**: Use `isActive` flags for user-facing deletions
- **Hard Deletes**: Implement after retention period (7 years for financial data)
- **Data Export**: Provide client data export functionality (GDPR/privacy compliance)
- **PII Minimization**: Collect only necessary client information

### Rate Limiting
Implement on API routes to prevent abuse:
```typescript
// Middleware example (planned)
const rateLimit = {
  timeEntries: 100, // per hour per tenant
  invoices: 50,
  login: 5 // per 15 minutes per IP
}
```

### Third-Party Security
- **Stripe**: Use webhook signature verification (see webhook handlers)
- **OAuth Tokens**: Refresh tokens encrypted, stored with expiry validation
- **Dependencies**: Regular `npm audit` and automated Dependabot updates
- **Environment Separation**: Dev/staging/prod with separate databases and API keys

## Responsive & Modern Design Principles

### Mobile-First Responsive Strategy
- **Breakpoints**: Tailwind default (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)
- **Layout**: Use CSS Grid and Flexbox, avoid fixed widths
- **Navigation**: Sidebar collapses to drawer/sheet on mobile (`Sheet` component)
- **Tables**: Horizontal scroll on mobile with sticky first column
- **Forms**: Stack inputs vertically on mobile, multi-column on desktop

Example responsive pattern:
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
  <Card>...</Card> {/* Single column mobile, 2 on tablet, 4 on desktop */}
</div>
```

### Accessibility (WCAG 2.1 AA)
- **Keyboard Navigation**: All interactive elements reachable via Tab/Enter
- **Focus Indicators**: Visible focus rings (Radix components handle this)
- **ARIA Labels**: Use `aria-label`, `aria-describedby` on icon-only buttons
- **Color Contrast**: Minimum 4.5:1 for text, 3:1 for UI components
- **Screen Readers**: Semantic HTML (`<nav>`, `<main>`, `<aside>`)

```tsx
<Button aria-label="Delete time entry" onClick={handleDelete}>
  <TrashIcon className="h-4 w-4" />
</Button>
```

### Modern UI Patterns
- **Dark Mode**: Default dark with light mode toggle (`next-themes`)
- **Loading States**: Skeleton screens, not spinners (better UX)
- **Optimistic Updates**: Update UI immediately, rollback on error
- **Toast Notifications**: Use `sonner` for non-blocking feedback
- **Animations**: Subtle transitions with `framer-motion` (avoid overdoing)

### Performance Optimizations
- **Image Optimization**: Use `next/image` with proper sizing
- **Code Splitting**: Dynamic imports for large components
- **Lazy Loading**: Defer non-critical data (infinite scroll for tables)
- **Caching**: SWR or React Query for client-side data caching (planned)

Example optimistic update:
```tsx
const [entries, setEntries] = useState(initialEntries)

const handleDelete = async (id: string) => {
  setEntries(prev => prev.filter(e => e.id !== id)) // Optimistic
  try {
    await deleteTimeEntry(id)
  } catch (error) {
    setEntries(initialEntries) // Rollback
    toast.error("Failed to delete entry")
  }
}
```

### Design System Consistency
- **Spacing**: Use Tailwind spacing scale (4px increments: p-4, gap-6, mb-8)
- **Typography**: Inter font family, consistent text sizes (text-sm for dense data, text-base for content)
- **Colors**: Semantic color system (destructive for delete, success for complete)
- **Border Radius**: Consistent rounding (rounded-lg for cards, rounded-md for inputs)
- **Icons**: Lucide React only (consistent stroke width, sizing)

### Component Composition
Build reusable patterns:
```tsx
// Bad: Inconsistent styling
<div className="bg-white p-4 rounded shadow">...</div>

// Good: Reusable Card component
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

## UI Component Patterns

### shadcn/ui Usage
Components live in `src/components/ui/` (owned code, not npm dependency). Install new ones via:
```bash
npx shadcn-ui@latest add [component-name]
```

### Form Patterns
Use `react-hook-form` with Zod validation:
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({ name: z.string().min(1), includedHours: z.number().positive() })
const form = useForm({ resolver: zodResolver(schema) })
```

### Data Tables
Use `@tanstack/react-table` via shadcn DataTable pattern. Example: `src/components/tables/time-entries-table.tsx`

## Integration Points

### Stripe
- **Customer Creation**: On first retainer/invoice for client
- **Checkout/Payment Links**: Generate via Stripe Invoicing API
- **Webhooks**: `/api/integrations/webhooks/stripe` handles payment success/failure

### Accounting Software (QuickBooks/Xero/Odoo)
- **OAuth Flow**: Initiated via `/api/integrations/connect?provider=qbo`
- **Sync Direction**: Clients → Customers (bidirectional), Invoices → push only (app to accounting)
- **Connection Storage**: `IntegrationConnection` table with encrypted tokens

### Email
Planned: Resend or Azure Communication Services (not yet implemented)

## Testing Guidelines

### Vitest (Unit/Integration)
Test business logic in isolation:
```typescript
// tests/lib/timezone.test.ts
import { getPeriodBoundary } from '@/lib/timezone'

it('calculates period boundary in Denver timezone', () => {
  const { startUtc, endUtc } = getPeriodBoundary(2025, 3, 'America/Denver')
  expect(startUtc.toISOString()).toBe('2025-03-01T07:00:00.000Z') // Denver MST → UTC
})
```

### Playwright (E2E)
Critical user flows in `tests/e2e/`:
- Time entry creation and editing
- Retainer period rollover
- Client portal login and invoice view

## Common Pitfalls

### Data & Business Logic
1. **Forgetting tenant scoping**: Always filter by `tenantId` in queries
2. **Timezone confusion**: Never store local times; use `toUTC()` before DB insert
3. **Period assignment**: Time entries must be assigned to correct `RetainerPeriod` based on retainer's timezone
4. **Prisma Client stale types**: Run `npm run db:generate` after schema changes
5. **Rollover logic**: Consume rollover hours FIRST (FIFO by expiry), check `rollover_expiry_date` against retainer timezone

### Security
6. **Missing authorization checks**: Always verify `session.user.tenantId` matches resource `tenantId`
7. **Logging sensitive data**: Never log passwords, tokens, or full credit card numbers
8. **Client-side validation only**: Always validate on server with Zod schemas
9. **Exposing existence**: Return same error for "not found" vs "forbidden" to prevent enumeration

### UI & UX
10. **Fixed widths**: Use responsive Tailwind classes (`w-full md:w-1/2`) instead of pixel values
11. **Missing loading states**: Show skeleton screens during data fetching
12. **Inaccessible buttons**: Icon-only buttons need `aria-label` attributes
13. **Inconsistent spacing**: Follow Tailwind spacing scale (p-4, gap-6, not arbitrary values)

## Key Reference Files

- **Architecture**: [Architecture.md](../Architecture.md) (comprehensive system design)
- **Schema**: [prisma/schema.prisma](../prisma/schema.prisma) (data model)
- **Auth Config**: [src/lib/auth.ts](../src/lib/auth.ts) (NextAuth setup)
- **Timezone Utils**: [src/lib/timezone.ts](../src/lib/timezone.ts) (conversion helpers)
- **DB Client**: [src/db/index.ts](../src/db/index.ts) (Prisma singleton)
