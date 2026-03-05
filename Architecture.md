# Retainer Management App — Architecture Document

## 1. Overview

A cloud-hosted retainer time tracking and billing application for IT consulting. Built as a standalone Next.js application with PostgreSQL, deployed on Azure. Designed for single-tenant use today with a clear path to multi-tenant SaaS.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router, Server Actions) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server) |
| ORM | Prisma |
| Auth | NextAuth.js (Azure AD B2C for SaaS pivot) |
| Hosting | Azure App Service (or Azure Container Apps) |
| File Storage | Azure Blob Storage (invoices, reports, exports) |
| Job Queue | BullMQ + Redis (Azure Cache for Redis) — for scheduled billing, rollover calculations |
| Payments | Stripe SDK (Checkout, Invoicing, Customer Portal) |
| Email | Azure Communication Services or Resend |
| PDF Generation | @react-pdf/renderer or Puppeteer |
| Timezone Handling | date-fns-tz (or Luxon) — all display/business logic conversions |
| Testing | Vitest + Playwright |
| UI Framework | Tailwind CSS 4 + shadcn/ui |
| Icons | Lucide React |
| Charts | Recharts (or Tremor for dashboard components) |
| Data Tables | TanStack Table (via shadcn/ui DataTable) |
| Animations | Framer Motion |
| Theme | Dark/light mode with next-themes |

---

## 2.5. Development Workflows

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

---

## 2.6. Project Structure Conventions

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

---

## 3. UI & Design System

### 3.1 Design Principles

```
- Clean, minimal, data-dense — this is a business tool, not a marketing site
- Dark mode first, light mode supported (toggle in header)
- Responsive: desktop-optimized with usable tablet/mobile layouts
- Consistent spacing, typography, and color usage via design tokens
- Keyboard navigable — power users should rarely need a mouse
- Loading states, skeleton screens, and optimistic updates throughout
```

### 3.2 Component Library: shadcn/ui + Tailwind CSS

```
Why shadcn/ui:
  - Not a dependency — components are copied into your codebase (src/components/ui/)
  - Built on Radix UI primitives (accessible, WAI-ARIA compliant)
  - Fully customizable with Tailwind — no fighting a library's opinions
  - First-class Next.js / React Server Component support
  - Active ecosystem with constant new components

Core components used:
  Layout:       Sidebar, Sheet (mobile nav), Tabs, Card, Separator
  Forms:        Input, Select, Combobox, DatePicker, Switch, Textarea
  Data:         DataTable (TanStack), Badge, Avatar, Progress
  Feedback:     Toast (sonner), Alert, Dialog, Tooltip
  Navigation:   Command (⌘K palette), Breadcrumb, Dropdown Menu
```

### 3.3 Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Top Bar: Logo / App Name    Search (⌘K)    Theme  User  │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  Sidebar   │  Page Content                               │
│            │                                             │
│  Dashboard │  ┌─ Breadcrumbs ──────────────────────┐    │
│  Clients   │  │                                     │    │
│  Retainers │  │  Page Header + Actions              │    │
│  Time      │  │                                     │    │
│  Invoices  │  │  ┌─ Content Area ────────────────┐  │    │
│  Reports   │  │  │                                │  │    │
│  ───────   │  │  │  Cards / Tables / Forms        │  │    │
│  Settings  │  │  │                                │  │    │
│  Integr.   │  │  └────────────────────────────────┘  │    │
│            │  └──────────────────────────────────────┘    │
│            │                                             │
├────────────┴─────────────────────────────────────────────┤
│  (Sidebar collapses to icons on smaller screens)         │
└──────────────────────────────────────────────────────────┘

Client Portal: Same shell, reduced sidebar (Dashboard, Time, Invoices)
```

### 3.4 Key Page Designs

**Dashboard (Admin)**
```
┌─────────────────────────────────────────────────────┐
│  4 KPI Cards (row):                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Active   │ │ Hours    │ │ Revenue  │ │ Overdue│ │
│  │ Retainers│ │ This Mo. │ │ This Mo. │ │Invoices│ │
│  │    12    │ │  86.5    │ │ $24,300  │ │   3    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  ┌─ Utilization Chart ──────┐ ┌─ Recent Activity ──┐│
│  │ Bar chart: hours used    │ │ Time entries, inv.  ││
│  │ vs included per client   │ │ payments — live feed││
│  └──────────────────────────┘ └─────────────────────┘│
│                                                      │
│  ┌─ Retainers Needing Attention ────────────────────┐│
│  │ Table: clients near/over limit, expiring soon     ││
│  └───────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Time Entry**
```
Two modes:
  1. Quick Entry — inline form at top of time log table
     [Client ▼] [Retainer ▼] [Category ▼] [Duration] [Description] [+ Add]

  2. Full Entry — slide-out Sheet/Drawer
     - Date picker, start/end time, or duration input
     - Client + retainer (linked selects)
     - Category selector
     - External description (client sees this)
     - Internal notes (staff only, collapsible)
     - Billable toggle

  Timer: Floating pill in bottom-right corner
     ┌─────────────────────────────────┐
     │  ▶ 01:23:45  │ Client Name │ ■ │
     └─────────────────────────────────┘
```

**Client Detail**
```
┌─ Header: Company Name ─── [Edit] [Portal Link] ──────┐
│                                                        │
│  Tabs: Overview | Retainers | Time Log | Invoices      │
│                                                        │
│  Overview:                                             │
│  ┌─ Active Retainer Card ──┐ ┌─ Billing Summary ────┐ │
│  │ Gold Plan — 40 hrs/mo   │ │ Outstanding: $1,200  │ │
│  │ ████████░░ 32/40 used   │ │ Last payment: Feb 1  │ │
│  │ Rollover: 4.5 hrs       │ │ Lifetime: $48,600    │ │
│  └─────────────────────────┘ └───────────────────────┘ │
│                                                        │
│  ┌─ Usage Trend (line chart, last 6 months) ──────────┐│
│  └────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

### 3.5 Design Tokens & Theme

```
Color Strategy:
  - Brand accent color (customizable per tenant for SaaS)
  - Semantic colors: success (green), warning (amber), danger (red), info (blue)
  - Neutral grays from Tailwind's zinc/slate palette
  - Dark mode: true dark (#09090b background), not just inverted

Typography:
  - Font: Inter (clean, modern, excellent for data-heavy UI)
  - Monospace: JetBrains Mono (for durations, numbers, code)
  - Scale: text-sm for dense data, text-base for content, text-lg+ for headings

Spacing:
  - 4px base unit (Tailwind default)
  - Cards: p-6, gap-6 between sections
  - Dense tables: p-3 cells for data grids

Border Radius:
  - Rounded-lg for cards and containers
  - Rounded-md for buttons and inputs
  - Consistent across all components via shadcn theme config
```

### 3.6 Responsive & Modern Design Principles

#### Mobile-First Responsive Strategy

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

#### Accessibility (WCAG 2.1 AA)

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

#### Modern UI Patterns

- **Dark Mode**: Default dark with light mode toggle (`next-themes`)
- **Loading States**: Skeleton screens, not spinners (better UX)
- **Optimistic Updates**: Update UI immediately, rollback on error
- **Toast Notifications**: Use `sonner` for non-blocking feedback
- **Animations**: Subtle transitions with `framer-motion` (avoid overdoing)

#### Performance Optimizations

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

#### Design System Consistency

- **Spacing**: Use Tailwind spacing scale (4px increments: p-4, gap-6, mb-8)
- **Typography**: Inter font family, consistent text sizes (text-sm for dense data, text-base for content)
- **Colors**: Semantic color system (destructive for delete, success for complete)
- **Border Radius**: Consistent rounding (rounded-lg for cards, rounded-md for inputs)
- **Icons**: Lucide React only (consistent stroke width, sizing)

#### Component Composition

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

### 3.7 UI Component Patterns

#### shadcn/ui Usage

Components live in `src/components/ui/` (owned code, not npm dependency). Install new ones via:
```bash
npx shadcn-ui@latest add [component-name]
```

#### Form Patterns

Use `react-hook-form` with Zod validation:
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({ name: z.string().min(1), includedHours: z.number().positive() })
const form = useForm({ resolver: zodResolver(schema) })
```

#### Data Tables

Use `@tanstack/react-table` via shadcn DataTable pattern. Example: `src/components/tables/time-entries-table.tsx`

### 3.8 Client Portal Design

```
Simplified, read-mostly interface:

  - Branded with the tenant's logo/colors
  - Dashboard: donut chart of hours remaining, usage bar by category
  - Time Log: filterable table, external descriptions only
  - Invoices: status badges (Paid ✓, Due, Overdue !)
  - No editing capability — view and pay only
  - Magic link or email/password auth (no complex onboarding)
```

---

## 4. Application Modules

### 4.1 Core Modules (MVP)

```
├── Auth & User Management
│   ├── Login / registration
│   ├── Role-based access (Admin, Staff, Client)
│   └── Session management
│
├── Client Management
│   ├── Client profiles (company, contacts, billing info)
│   ├── Client-specific settings
│   └── Client portal access provisioning
│
├── Retainer Management
│   ├── Retainer agreements (per-client)
│   ├── Retainer templates (Bronze/Silver/Gold etc.)
│   ├── Hour block allocation
│   ├── Rate tiers (standard, overage tier 1, tier 2, etc.)
│   ├── Rollover rules (cap, percentage limit, expiration)
│   └── Retainer lifecycle (active, paused, expired, cancelled)
│
├── Time Tracking
│   ├── Manual time entry (to the minute)
│   ├── Optional timer function
│   ├── Configurable categories/tags
│   ├── Internal notes (staff-only)
│   ├── External descriptions (client-visible)
│   └── Entry editing / approval workflow
│
├── Expense Tracking
│   ├── Expense entry (amount, date, category, description)
│   ├── Document upload (receipts, invoices - Azure Blob Storage)
│   ├── Multiple file attachments per expense
│   ├── Expense categories (customizable per tenant)
│   ├── Client/retainer association
│   ├── Billable vs non-billable marking
│   ├── Approval workflow (DRAFT|SUBMITTED|APPROVED|REJECTED)
│   ├── Reimbursement tracking
│   └── Include in invoice generation (billable expenses)
│
├── Billing Engine
│   ├── Monthly billing cycle automation (cron/scheduled job)
│   ├── Usage calculation (included hours, overage, tiered rates)
│   ├── Rollover processing
│   ├── Invoice generation or push to accounting software
│   └── Overage billed-in-arrears logic
│
├── Client Portal
│   ├── Retainer balance / usage dashboard
│   ├── Time log viewer (with external notes only)
│   ├── Invoice history
│   ├── PDF download (invoices, usage reports)
│   └── Payment status visibility
│
└── Reporting & Analytics
    ├── Utilization rates (per client, per period)
    ├── Profitability per client
    ├── Aging / outstanding invoices
    ├── Rollover tracking
    └── Forecasting (projected usage, revenue)
```

### 4.2 Integration Layer

```
├── Accounting Integrations (pick one or many)
│   ├── QuickBooks Online (OAuth2, REST API)
│   ├── Xero (OAuth2, REST API)
│   └── Odoo (XML-RPC / JSON-RPC API)
│   
│   Sync Strategy:
│   ├── Clients → Customers (bidirectional)
│   ├── Invoices → pushed from app to accounting
│   ├── Payments → webhook sync back to app
│   └── Chart of accounts mapping
│
├── Payment Processing (Stripe)
│   ├── Customer creation & payment method storage
│   ├── Invoice creation via Stripe Invoicing API
│   ├── AutoPay (saved card / ACH)
│   ├── Payment links for manual pay
│   └── Webhook handlers (payment success/failure)
│
└── Future: CRM Integration (roadmap)
    ├── HubSpot / Salesforce / ConnectWise
    └── Contact sync, deal/opportunity mapping
```

#### Integration Points Details

**Stripe**
- **Customer Creation**: On first retainer/invoice for client
- **Checkout/Payment Links**: Generate via Stripe Invoicing API
- **Webhooks**: `/api/integrations/webhooks/stripe` handles payment success/failure

**Accounting Software (QuickBooks/Xero/Odoo)**
- **OAuth Flow**: Initiated via `/api/integrations/connect?provider=qbo`
- **Sync Direction**: Clients → Customers (bidirectional), Invoices → push only (app to accounting)
- **Connection Storage**: `IntegrationConnection` table with encrypted tokens

**Email**
Planned: Resend or Azure Communication Services (not yet implemented)

---

## 4.3. Authentication & Authorization

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

---

## 5. Database Schema (Key Entities)

### Tenancy & Auth
```
Tenant                    (future: multi-tenant support)
  id, name, slug, settings, timezone (IANA), created_at

User
  id, tenant_id, email, name, role (ADMIN|STAFF|CLIENT)
  password_hash, avatar_url, timezone (IANA, nullable → falls back to tenant)
  is_active, created_at

Session / Account         (NextAuth managed)
```

### Client & Retainer
```
Client
  id, tenant_id, company_name, primary_contact_name
  email, phone, address, billing_email
  timezone (IANA, nullable → falls back to tenant)
  stripe_customer_id, accounting_customer_id
  is_active, created_at

  → has many: ClientContact, Retainer, Invoice

RetainerTemplate
  id, tenant_id, name, description
  included_hours, rate_per_hour
  overage_tiers (JSON: [{from_hours, to_hours, rate}])
  rollover_enabled, rollover_cap_type (PERCENTAGE|FIXED)
  rollover_cap_value, rollover_expiry_months
  is_active, created_at

Retainer
  id, tenant_id, client_id, template_id (nullable)
  name, status (ACTIVE|PAUSED|EXPIRED|CANCELLED)
  included_hours, rate_per_hour
  overage_tiers (JSON)
  rollover_enabled, rollover_cap_type, rollover_cap_value
  rollover_expiry_months
  timezone (IANA, inherited from tenant, overridable)
  billing_day, start_date, end_date (nullable)
  created_at

RetainerPeriod
  id, retainer_id
  period_start, period_end
  included_hours, rollover_hours_in, rollover_expiry_date
  used_hours (computed/cached), overage_hours (computed)
  status (OPEN|CLOSED|BILLED)
  created_at

  → This is the monthly "bucket" that tracks allocation + usage
```

### Time Tracking
```
TimeCategory
  id, tenant_id, name, color, is_active, sort_order

TimeEntry
  id, tenant_id, retainer_id, retainer_period_id
  user_id (who logged it), client_id
  category_id, start_time (UTC), end_time (UTC), duration_minutes
  entry_timezone (IANA — the timezone the user was in when logging)
  external_description (client-visible)
  internal_notes (staff-only)
  is_billable, status (DRAFT|SUBMITTED|APPROVED)
  created_at, updated_at
```

### Expense Tracking
```
ExpenseCategory
  id, tenant_id, name, color, is_active, sort_order
  gl_account (optional mapping for accounting integration)

Expense
  id, tenant_id, client_id, retainer_id (nullable)
  user_id (who submitted it), category_id
  amount, currency (default USD)
  expense_date (DATE — when expense occurred)
  merchant, description
  internal_notes (staff-only)
  is_billable, is_reimbursable
  status (DRAFT|SUBMITTED|APPROVED|REJECTED|REIMBURSED)
  approved_by (user_id, nullable), approved_at
  rejected_reason (nullable)
  invoice_id (nullable — if included in invoice)
  created_at, updated_at

  → has many: ExpenseDocument

ExpenseDocument
  id, expense_id
  file_name, file_size, mime_type
  blob_url (Azure Blob Storage path)
  uploaded_by (user_id), uploaded_at
  is_receipt (boolean — primary receipt vs supporting doc)
```

### Billing & Invoicing
```
Invoice
  id, tenant_id, client_id, retainer_period_id
  invoice_number, status (DRAFT|SENT|PAID|OVERDUE|VOID)
  issued_date, due_date, paid_date
  subtotal, tax (0 for now), total
  stripe_invoice_id, accounting_invoice_id
  pdf_url, created_at

InvoiceLineItem
  id, invoice_id
  description, quantity, unit_price, total
  line_type (RETAINER_FEE|OVERAGE|ROLLOVER_CREDIT|EXPENSE|ADJUSTMENT)
  expense_id (nullable — if line item is for an expense)

Payment
  id, invoice_id, amount, payment_method
  stripe_payment_intent_id, status
  paid_at, created_at
```

### Integration & Sync
```
IntegrationConnection
  id, tenant_id, provider (QBO|XERO|ODOO|STRIPE)
  access_token (encrypted), refresh_token (encrypted)
  token_expiry, config (JSON), status
  last_sync_at, created_at

SyncLog
  id, integration_id, direction (IN|OUT)
  entity_type, entity_id, external_id
  status (SUCCESS|FAILED), error_message
  synced_at
```

---

## 6. Timezone Strategy

### 6.1 Core Principle: Store UTC, Display Local

```
GOLDEN RULE:
  - Database: ALL timestamps stored as UTC (timestamptz in PostgreSQL)
  - Server: ALL logic runs against UTC
  - Client: ALL display converted to user's/client's local timezone
  - Billing: Cycle boundaries calculated in the TENANT's timezone, then converted to UTC
```

### 6.2 Timezone Fields

```
Tenant
  + timezone       e.g., "America/Denver" (IANA timezone)
                   This is the business's operating timezone.
                   Used for: billing cycle boundaries, report date ranges,
                   default for new users.

User
  + timezone       e.g., "America/New_York" (IANA timezone)
                   Overrides tenant timezone for display.
                   Used for: time entry display, dashboard dates,
                   "today" calculations.

Client
  + timezone       e.g., "America/Chicago" (IANA timezone)
                   Used for: client portal display, invoice dates,
                   email send times.

Retainer
  + timezone       Inherited from tenant by default, overridable.
                   CRITICAL: This is the timezone used to determine
                   period boundaries (when a "month" starts/ends).
```

### 6.3 Where Timezone Matters Most

**Time Entry Recording**
```
When a user logs time:
  1. UI sends: { start: "2025-03-15T09:00", end: "2025-03-15T10:30", timezone: "America/Denver" }
  2. Server converts to UTC: { start: "2025-03-15T16:00:00Z", end: "2025-03-15T17:30:00Z" }
  3. Stores UTC + original timezone reference
  4. Duration calculated from UTC (immune to DST issues)

When displaying:
  - To staff: convert UTC → user.timezone
  - To client: convert UTC → client.timezone
  - On invoices: convert UTC → retainer.timezone (or client.timezone)
```

**Timer Function**
```
Timer runs client-side in browser (uses local clock).
On stop:
  1. Browser sends start_utc, end_utc, duration_ms, user_timezone
  2. Server validates duration matches UTC delta (within tolerance)
  3. Stores UTC timestamps
  
  Edge case: DST transition during active timer
  → Duration is calculated from UTC, so "spring forward" or "fall back"
    doesn't create phantom hours or missing time.
```

**Billing Cycle Boundaries**
```
"Monthly billing on the 1st" means different things in different timezones.

For a retainer with timezone = "America/Denver" (UTC-7 / UTC-6 DST):
  March period = 2025-03-01T00:00:00 America/Denver → 2025-03-01T07:00:00Z
            to   2025-04-01T00:00:00 America/Denver → 2025-04-01T06:00:00Z (DST shift!)

The billing cron job:
  1. Runs frequently (e.g., every 15 min) checking all retainers
  2. For each retainer: "Is NOW >= period_end in this retainer's timezone?"
  3. If yes → trigger billing cycle for that retainer
  
  This avoids the "run at midnight UTC" problem where some tenants
  get billed on the wrong day.
```

**Rollover Expiration**
```
Rollover expiry is date-based (not timestamp-based):
  - "Expires after 3 months" means the rollover hours from January
    expire at end-of-day March 31 in the retainer's timezone.
  - Stored as: rollover_expiry_date (DATE type, no time component)
  - Evaluated against retainer.timezone when processing.
```

### 6.4 Implementation Helpers

```typescript
// Utility module: src/lib/timezone.ts

import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';

// Convert a "wall clock" time in a timezone to UTC for storage
function toUTC(localTime: Date, timezone: string): Date

// Convert UTC to a specific timezone for display
function toLocal(utcTime: Date, timezone: string): Date

// Get the start of a billing period in a timezone, returned as UTC
function getPeriodBoundary(year: number, month: number, timezone: string): {
  startUtc: Date;
  endUtc: Date;
}

// Determine which RetainerPeriod a UTC timestamp falls into
function getPeriodForTimestamp(utcTimestamp: Date, retainerTimezone: string): {
  year: number;
  month: number;
}

// Format a UTC date for display in a specific timezone
function formatForDisplay(utcTime: Date, timezone: string, fmt: string): string
```

### 6.5 Database Configuration

```sql
-- PostgreSQL server timezone should be UTC
SET timezone = 'UTC';

-- All timestamp columns use timestamptz (timestamp with time zone)
-- Prisma: use @db.Timestamptz for DateTime fields

-- Timezone identifier columns use TEXT validated against pg_timezone_names
-- e.g., CHECK (timezone IN (SELECT name FROM pg_timezone_names))
```

---

## 7. Key Business Logic

### 7.1 Monthly Billing Cycle (Scheduled Job)

```
On billing day (per retainer):
1. Close current RetainerPeriod
   a. Calculate total used_hours from TimeEntries
   b. Calculate overage_hours (used - included - rollover_in)
   c. Apply tiered overage rates

2. Generate Invoice
   a. Line item: Monthly retainer fee (included_hours × rate)
   b. Line item(s): Overage from PREVIOUS month (billed in arrears)
   c. Push to Stripe and/or accounting software

3. Process Rollover
   a. remaining = included_hours + rollover_in - used_hours
   b. If rollover_enabled:
      - Apply percentage cap: rollover_out = min(remaining, cap%)
      - Set expiry date on rollover hours
   c. Else: remaining hours expire

4. Open new RetainerPeriod
   a. Set included_hours + rollover_hours_in
   b. Status = OPEN

5. Send invoice to client (email + portal notification)
```

### 7.2 Rollover Logic

```
Configurable per retainer:
- rollover_cap_type: PERCENTAGE or FIXED
- rollover_cap_value: e.g., 50 (meaning 50% or 50 hours)
- rollover_expiry_months: e.g., 3 (hours expire after 3 months)

Rollover hours consumed FIRST (FIFO by expiry date)
Expired rollover hours are zeroed out in the nightly job
```

### 7.3 Overage Tier Calculation

```
overage_tiers: [
  { from: 0,  to: 5,    rate: 150 },
  { from: 5,  to: 10,   rate: 175 },
  { from: 10, to: null,  rate: 200 }  // uncapped
]

For 12 overage hours:
  5 hours × $150 = $750
  5 hours × $175 = $875
  2 hours × $200 = $400
  Total overage: $2,025
```

### 7.4 Business Logic Patterns

#### Retainer Billing Cycle (Monthly Job)
1. Close `RetainerPeriod` → calculate `used_hours` and `overage_hours` from `TimeEntry` sum
2. Generate `Invoice` with line items: retainer fee + previous month's overage (billed in arrears)
3. Process rollover: `remaining = included_hours + rollover_in - used_hours`
   - Apply cap: `rollover_out = min(remaining, cap_percentage × included_hours)`
   - Set `rollover_expiry_date` (DATE field, evaluated in retainer timezone)
4. Open new `RetainerPeriod` with `rollover_hours_in` from previous period

#### Time Entry Display Rules
- **Admin/Staff**: Show `external_description` + `internal_notes` (full detail)
- **Client Portal**: Show `external_description` only
- **Time Zone**: Convert `start_time`/`end_time` (stored UTC) to viewer's timezone
- **Duration**: Always calculated from UTC timestamps (immune to DST)

#### Expense Management & Billing Integration

**Expense Submission Workflow**
1. User creates expense → status: `DRAFT`
2. User uploads receipts/documents (1+ required for expenses > $25)
3. User submits for approval → status: `SUBMITTED`
4. Admin/Manager reviews → `APPROVED` or `REJECTED`
   - If rejected: add rejection reason, user can edit and resubmit
5. Approved expenses:
   - If `is_billable = true` → included in next invoice for that client
   - If `is_reimbursable = true` → tracked for employee reimbursement

**Expense to Invoice Flow**
```typescript
// Monthly billing cycle includes approved billable expenses
const billableExpenses = await prisma.expense.findMany({
  where: {
    clientId: client.id,
    status: "APPROVED",
    isBillable: true,
    invoiceId: null, // not yet invoiced
    expenseDate: { gte: periodStart, lte: periodEnd }
  }
})

// Add expense line items to invoice
for (const expense of billableExpenses) {
  invoiceLineItems.push({
    description: `${expense.category.name}: ${expense.description}`,
    quantity: 1,
    unitPrice: expense.amount,
    total: expense.amount,
    lineType: "EXPENSE",
    expenseId: expense.id
  })
  
  // Mark expense as invoiced
  await prisma.expense.update({
    where: { id: expense.id },
    data: { invoiceId: invoice.id }
  })
}
```

**File Upload Security**
- File type validation (PDF, JPG, PNG only)
- File size limit: 10MB per document
- Virus scanning before storage (Azure Defender)
- Generate unique blob path: `{tenantId}/expenses/{expenseId}/{uuid}-{filename}`
- Return SAS token URL with 1-hour expiry for download
- Delete orphaned files (expenses deleted before approval)

**Document Download Pattern**
```typescript
// Generate short-lived SAS token for secure document access
import { BlobServiceClient, generateBlobSASQueryParameters } from '@azure/storage-blob'

async function getDocumentDownloadUrl(documentId: string, session: Session) {
  const document = await prisma.expenseDocument.findUnique({
    where: { id: documentId },
    include: { expense: { include: { client: true } } }
  })
  
  // Validate tenant access
  if (document.expense.tenantId !== session.user.tenantId) {
    throw new Error("Forbidden")
  }
  
  // Generate SAS token (1 hour expiry)
  const sasToken = generateBlobSASQueryParameters({
    containerName: "expenses",
    blobName: document.blobUrl,
    permissions: "r",
    expiresOn: new Date(Date.now() + 3600 * 1000)
  }, sharedKeyCredential)
  
  return `${blobServiceClient.url}/${document.blobUrl}?${sasToken}`
}
```

---

## 7.5. Security Best Practices & SOC2 Compliance

### Authentication & Session Security

- **Password Storage**: Use `bcrypt` with salt rounds ≥12 (see `src/lib/auth.ts`)
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
- Data modifications (create/update/delete on Client, Retainer, Invoice, Expense)
- Permission changes (role assignments, integration connections)
- Sensitive operations (payment processing, data exports, expense approvals)
- File uploads/deletions (expense documents)

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
  expenses: 50, // per hour per tenant
  fileUploads: 20, // per hour per tenant
  login: 5 // per 15 minutes per IP
}
```

### Third-Party Security

- **Stripe**: Use webhook signature verification (see webhook handlers)
- **OAuth Tokens**: Refresh tokens encrypted, stored with expiry validation
- **File Uploads**: Validate file types, scan for malware, enforce size limits
- **Blob Storage**: Use SAS tokens with expiry, never public access
- **Dependencies**: Regular `npm audit` and automated Dependabot updates
- **Environment Separation**: Dev/staging/prod with separate databases and API keys

---

## 8. API Route Structure (Next.js App Router)

```
/api
├── /auth              (NextAuth routes)
├── /clients
│   ├── GET /              list clients
│   ├── POST /             create client
│   ├── GET /[id]          get client detail
│   ├── PATCH /[id]        update client
│   └── GET /[id]/retainers
│
├── /retainers
│   ├── GET /              list retainers
│   ├── POST /             create retainer
│   ├── GET /[id]          get retainer + current period
│   ├── PATCH /[id]        update retainer
│   ├── GET /[id]/periods  list periods
│   └── GET /[id]/periods/[periodId]
│
├── /templates
│   ├── CRUD for retainer templates
│
├── /time-entries
│   ├── GET /              list (filterable by client, retainer, date)
│   ├── POST /             create entry
│   ├── PATCH /[id]        update entry
│   ├── DELETE /[id]       delete entry
│   └── POST /timer        start/stop timer
│
├── /categories
│   ├── CRUD for time categories
│
├── /expenses
│   ├── GET /              list expenses (filterable by client, date, status)
│   ├── POST /             create expense
│   ├── PATCH /[id]        update expense
│   ├── DELETE /[id]       delete expense
│   ├── POST /[id]/documents  upload document
│   ├── GET /[id]/documents   list documents
│   ├── DELETE /[id]/documents/[docId]  delete document
│   ├── GET /[id]/documents/[docId]/download  download document
│   ├── POST /[id]/approve    approve expense
│   └── POST /[id]/reject     reject expense
│
├── /expense-categories
│   ├── CRUD for expense categories
│
├── /invoices
│   ├── GET /              list invoices
│   ├── GET /[id]          invoice detail
│   ├── POST /[id]/send    send invoice
│   └── GET /[id]/pdf      download PDF
│
├── /billing
│   ├── POST /run-cycle    trigger billing cycle (admin/cron)
│   └── POST /rollover     trigger rollover processing
│
├── /integrations
│   ├── POST /connect      OAuth flow initiation
│   ├── POST /disconnect
│   ├── POST /sync         manual sync trigger
│   └── POST /webhooks/[provider]  incoming webhooks
│
├── /portal               (client-facing, scoped by client auth)
│   ├── GET /dashboard     retainer balance, usage summary
│   ├── GET /time-entries  their time logs
│   ├── GET /expenses      their expense logs (billable to them)
│   ├── GET /invoices      their invoices
│   └── GET /invoices/[id]/pdf
│
└── /reports
    ├── GET /utilization
    ├── GET /profitability
    ├── GET /aging
    └── GET /forecast
```

---

## 9. Deployment Architecture (Azure)

```
┌─────────────────────────────────────────────────┐
│                    Azure                         │
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │ Azure CDN /  │    │ Azure App Service      │  │
│  │ Front Door   │───▶│ (Next.js container)    │  │
│  └──────────────┘    │                        │  │
│                      │ - SSR + API routes     │  │
│                      │ - Server Actions       │  │
│                      └──────────┬─────────────┘  │
│                                 │                 │
│              ┌──────────────────┼──────────┐      │
│              ▼                  ▼          ▼      │
│  ┌────────────────┐ ┌──────────────┐ ┌────────┐ │
│  │ Azure Database │ │ Azure Cache  │ │ Azure  │ │
│  │ for PostgreSQL │ │ for Redis    │ │ Blob   │ │
│  │ (Flexible)     │ │ (BullMQ)    │ │ Storage│ │
│  └────────────────┘ └──────────────┘ └────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Azure Functions (optional, for workers)   │   │
│  │ - Billing cycle cron                      │   │
│  │ - Rollover expiry processing              │   │
│  │ - Webhook processing                      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  External:                                       │
│  ├── Stripe API (payments, invoicing)            │
│  ├── QBO / Xero / Odoo API (accounting sync)     │
│  └── Resend / Azure Comms (email)                │
└─────────────────────────────────────────────────┘
```

---

## 9.5. Testing Guidelines

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
- Expense submission with document upload
- Expense approval/rejection workflow

---

## 10. SaaS Pivot Considerations

Built into the architecture from day one:

- **tenant_id on every table** — even if there's only one tenant now, the column exists and queries are scoped. Migration to multi-tenant is seamless.
- **Azure AD B2C** — swap in for auth when ready; supports custom signup flows, MFA, social login.
- **Subdomain routing** — `acme.retainerapp.com` per tenant, handled via Next.js middleware.
- **Stripe Connect** — each tenant connects their own Stripe account for payment processing.
- **Feature flags** — tier-gate features (e.g., templates on Pro plan, integrations on Enterprise).
- **Usage-based metering** — track API calls, active retainers, clients per tenant for billing.

---

## 11. Development Phases

### Phase 1 — Foundation (Weeks 1–3) ✅ COMPLETE
- ✅ Project scaffolding (Next.js, Prisma, PostgreSQL, auth)
- ✅ User and client CRUD  
- ✅ Basic retainer creation and management (+ overage rates, cancel/edit/delete, travel config)
- ✅ Time entry (manual) with categories and notes

### Phase 2 — Billing Core (Weeks 4–6) ✅ COMPLETE
- ✅ Retainer period management and rollover logic
- ✅ Overage tier calculation engine
- ✅ Invoice generation (internal, PDF export)
- ✅ Stripe integration (customer, payment links, autopay)
- ✅ Expense tracking schema (models added to database)
- ✅ Expense tracking with document upload (Azure Blob Storage)
- ✅ Expense approval workflow
- ✅ Expense to invoice integration (billable expenses)
- ✅ BullMQ billing cycle worker

### Phase 3 — Client Portal (Weeks 7–8) ✅ COMPLETE
- ✅ Client authentication (password + magic link login)
- ✅ Dashboard: retainer balance, usage chart, recent entries
- ✅ Invoice list and PDF downloads
- ✅ Billable expense visibility (view expenses billed to them)
- ✅ Payment status (Stripe Checkout integration)

### Phase 4 — Accounting Integration (Weeks 9–11)
- OAuth connection flow for QBO/Xero/Odoo
- Customer sync (bidirectional)
- Invoice push (app → accounting software)
- Payment webhook sync (accounting → app)

### Phase 5 — Polish & Reporting (Weeks 12–14)
- Utilization and profitability reports
- Aging invoices dashboard
- Forecasting
- Email notifications (invoice sent, payment received, retainer low)
- Timer function for time tracking

### Phase 6 — SaaS Prep (Future)
- Multi-tenant isolation
- Onboarding flow
- Subscription billing (Stripe for the app itself)
- Admin super-dashboard

---

## 12. Common Pitfalls

### Data & Business Logic

1. **Forgetting tenant scoping**: Always filter by `tenantId` in queries
2. **Timezone confusion**: Never store local times; use `toUTC()` before DB insert
3. **Period assignment**: Time entries must be assigned to correct `RetainerPeriod` based on retainer's timezone
4. **Prisma Client stale types**: Run `npm run db:generate` after schema changes
5. **Rollover logic**: Consume rollover hours FIRST (FIFO by expiry), check `rollover_expiry_date` against retainer timezone
6. **Orphaned documents**: Delete blob storage files when expense is deleted before approval
7. **Double-billing expenses**: Check `invoiceId` is null before adding expense to invoice

### Security

8. **Missing authorization checks**: Always verify `session.user.tenantId` matches resource `tenantId`
9. **Logging sensitive data**: Never log passwords, tokens, or full credit card numbers
10. **Client-side validation only**: Always validate on server with Zod schemas
11. **Exposing existence**: Return same error for "not found" vs "forbidden" to prevent enumeration
12. **File upload vulnerabilities**: Always validate file type, scan for malware, enforce size limits
13. **Public blob URLs**: Never use public blob containers; always use SAS tokens with expiry
14. **Missing virus scan**: Run Azure Defender scan before accepting uploaded files

### UI & UX

15. **Fixed widths**: Use responsive Tailwind classes (`w-full md:w-1/2`) instead of pixel values
16. **Missing loading states**: Show skeleton screens during data fetching
17. **Inaccessible buttons**: Icon-only buttons need `aria-label` attributes
18. **Inconsistent spacing**: Follow Tailwind spacing scale (p-4, gap-6, not arbitrary values)
19. **Large file uploads without progress**: Show upload progress bar for files > 1MB
20. **No file preview**: Provide thumbnail/preview for uploaded images before submission

---

## 13. Key Reference Files

- **Architecture**: [Architecture.md](Architecture.md) (this document - comprehensive system design)
- **Schema**: [prisma/schema.prisma](prisma/schema.prisma) (data model)
- **Auth Config**: [src/lib/auth.ts](src/lib/auth.ts) (NextAuth setup)
- **Timezone Utils**: [src/lib/timezone.ts](src/lib/timezone.ts) (conversion helpers)
- **DB Client**: [src/db/index.ts](src/db/index.ts) (Prisma singleton)