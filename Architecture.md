# Retainer Management App — Architecture Document

## 1. Overview

A cloud-hosted retainer time tracking and billing application for IT consulting. Built as a standalone Next.js application with PostgreSQL, Redis, and Stripe, with Azure-oriented storage/deployment integrations. The current implementation already uses tenant-scoped data, onboarding, admin tenant management, client portal access, and subdomain-aware routing, while still leaving room for a fuller SaaS control plane later.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router, route handlers, server components) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server) |
| ORM | Prisma |
| Auth | NextAuth.js with credentials auth, client magic links, invite-based onboarding |
| Hosting | Azure App Service (or Azure Container Apps) |
| File Storage | Azure Blob Storage with private blobs + SAS URLs, local fallback for development |
| Job Queue | BullMQ + Redis (Azure Cache for Redis) — for scheduled billing, rollover calculations |
| Payments | Stripe SDK (Checkout Sessions, Payment Intents, webhooks) |
| Email | Resend (current) with Azure Communication Services as an alternative |
| PDF Generation | HTML-based invoice/timesheet export today, Puppeteer-capable path for richer PDFs |
| Timezone Handling | date-fns-tz (or Luxon) — all display/business logic conversions |
| Testing | Vitest + Playwright |
| UI Framework | Tailwind CSS 3 + shadcn/ui |
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
npm run db:seed           # Seed development data
npm run worker            # Start BullMQ billing worker
npm run worker:dev        # Start billing worker in watch mode
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
├── app/                      # Next.js App Router pages and route handlers
│   ├── admin/                # System/admin views (tenants, users, settings)
│   ├── auth/                 # Sign-in, setup, invitation acceptance
│   ├── api/                  # Route handlers for app APIs
│   ├── dashboard/            # Staff/admin operational app
│   ├── landing/              # Marketing/landing shell
│   ├── portal/               # Client portal pages
│   └── layout.tsx            # Root layout with theme provider
├── components/
│   ├── ui/                   # shadcn/ui primitives (copied, not imported)
│   ├── dashboard/            # Feature-specific components
│   └── theme-provider.tsx    # Dark/light mode with next-themes
├── jobs/                     # BullMQ worker and billing scheduler
├── lib/
│   ├── auth.ts               # NextAuth config, lockout, session shaping
│   ├── audit.ts              # Audit logging helpers and action constants
│   ├── billing.ts            # Rollover and overage calculations
│   ├── email.ts              # Resend-backed transactional emails
│   ├── rate-limit.ts         # Redis-backed rate limiting
│   ├── storage.ts            # Azure Blob + local storage fallback
│   ├── stripe.ts             # Stripe Checkout / Payment Intent / webhook helpers
│   ├── timezone.ts           # Monthly + biweekly period utilities
│   └── utils.ts              # cn() helper + misc utilities
├── db/
│   └── index.ts              # Prisma Client singleton export
├── types/
│   └── index.ts              # Shared TypeScript types
├── integrations/             # QuickBooks/Xero OAuth helpers
└── middleware.ts             # Edge middleware for subdomains, auth gates, security headers
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
  - Invitation-based access + magic-link login for clients
```

---

## 4. Application Modules

### 4.1 Core Modules (MVP)

```
├── Auth, Identity & Access
│   ├── Tenant signup / bootstrap
│   ├── Credentials login for staff/admin users
│   ├── Client magic-link login
│   ├── Invite-based team and client access
│   ├── Role-based access (ADMIN, STAFF, CLIENT)
│   ├── Session management + middleware enforcement
│   └── Account lockout + login rate limiting
│
├── Tenant Operations
│   ├── Tenant-scoped settings JSON + timezone
│   ├── Onboarding progress / completion tracking
│   ├── Admin tenant overview
│   └── Future-ready multi-tenant expansion
│
├── Client Management
│   ├── Client profiles (company, contacts, billing info)
│   ├── Client-specific settings
│   └── Client portal access provisioning via invitation
│
├── Retainer Management
│   ├── Retainer agreements (per-client)
│   ├── Retainer templates (Bronze/Silver/Gold etc.)
│   ├── Hour block allocation
│   ├── Rate tiers (standard, overage tier 1, tier 2, etc.)
│   ├── Rollover rules (cap, percentage limit, expiration)
│   ├── Billing cycle selection (monthly or biweekly)
│   ├── Travel time / travel expense configuration
│   └── Retainer lifecycle (active, paused, expired, cancelled)
│
├── Time Tracking
│   ├── Manual time entry (to the minute)
│   ├── Optional timer function
│   ├── Configurable categories/tags
│   ├── Internal notes (staff-only)
│   ├── External descriptions (client-visible)
│   ├── Travel time flagging
│   ├── Invoice linkage for billed work
│   └── Period assignment by retainer billing cycle + timezone
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
│   ├── Biweekly period calculation + invoice support
│   ├── Usage calculation (included hours, overage, tiered rates)
│   ├── Rollover processing
│   ├── Travel time / deferred overage handling
│   ├── Invoice generation, payment links, and payment recording
│   └── Invoice generation or push to accounting software
│
├── Client Portal
│   ├── Retainer balance / usage dashboard
│   ├── Time log viewer (with external notes only)
│   ├── Expense visibility
│   ├── Invoice history
│   ├── PDF download (invoices, usage reports)
│   ├── Self-service payment links
│   └── Payment status visibility
│
├── Reporting & Analytics
│   ├── Utilization rates (per client, per period)
│   ├── Profitability per client
│   ├── Aging / outstanding invoices
│   ├── Rollover tracking
│   └── Forecasting (projected usage, revenue)
│
└── Audit & Compliance
    ├── Audit log persistence for auth and data mutations
    ├── Admin audit-log retrieval API
    ├── Security headers in middleware
    └── Redis-backed rate limiting for sensitive operations
```

### 4.2 Integration Layer

```
├── Accounting Integrations
│   ├── QuickBooks Online (OAuth2, REST API)
│   └── Xero (OAuth2, REST API)
│   
│   Sync Strategy:
│   ├── OAuth connect + callback flow
│   ├── Connection storage in IntegrationConnection
│   ├── Future customer/invoice sync expansion
│   └── Optional chart-of-accounts mapping via category GL fields
│
├── Payment Processing (Stripe)
│   ├── Customer creation & payment method storage
│   ├── Stripe Checkout Sessions
│   ├── Payment Intents for embedded/custom flows
│   ├── Payment links for manual pay
│   └── Webhook handlers (payment success/failure, checkout completion)
│
└── Email Delivery
    ├── Resend transactional email delivery
    ├── Welcome emails
    ├── Team/client invitation emails
    ├── Invoice/payment notifications
    └── Retainer low-hours alerts
```

#### Integration Points Details

**Stripe**
- **Customer Creation**: On first retainer/invoice for client
- **Checkout/Payment Links**: Generate via Checkout Sessions and Payment Intents
- **Webhooks**: `/api/stripe/webhook` handles payment success/failure and checkout completion

**Accounting Software (QuickBooks/Xero)**
- **OAuth Flow**: Initiated via `/api/integrations/connect?provider=qbo`
- **Callback**: `/api/integrations/callback?provider=...`
- **Connection Storage**: `IntegrationConnection` table with provider-specific config
- **Current State**: OAuth connection is implemented; deep customer/invoice sync is still incremental

**Email**
Resend is implemented for welcome emails, magic links, invitations, invoice notices, payment notices, and retainer low-hour alerts.

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

### Implemented Auth Flows

```
1. Tenant bootstrap
   - Public setup flow creates a Tenant + initial ADMIN user

2. Staff/Admin authentication
   - NextAuth credentials provider
   - JWT session enrichment with role, tenantId, timezone
   - Login rate limiting and temporary lockout after repeated failures

3. Team invitations
   - ADMIN/STAFF can invite users into an existing tenant
   - Invitation token is stored with expiry + acceptance metadata

4. Client access
   - Client invitation creates/grants CLIENT access
   - Client portal supports passwordless magic-link login

5. Edge enforcement
   - Middleware rewrites admin/landing subdomain traffic
   - Middleware blocks unauthorized dashboard, portal, admin, and protected API access
   - Security headers applied globally at the edge
```

---

## 5. Database Schema (Key Entities)

### Tenancy & Auth
```
Tenant
  id, name, slug, settings, timezone (IANA)
  onboarding_completed, onboarding_completed_at
  created_at

User
  id, tenant_id, email, name, role (ADMIN|STAFF|CLIENT)
  password_hash, avatar_url, timezone (IANA, nullable → falls back to tenant)
  is_active, failed_login_attempts, locked_until, created_at

VerificationToken
  identifier, token, expires

TenantInvitation
  id, tenant_id, email, role
  invited_by, invitation_token, expires_at
  accepted_at, accepted_user_id, is_active, created_at

ClientInvitation
  id, tenant_id, client_id, email
  invited_by, invitation_token, expires_at
  accepted_at, accepted_user_id, is_active, created_at

Session / Account         (NextAuth managed)
```

### Client & Retainer
```
Client
  id, tenant_id, company_name, primary_contact_name
  email, phone
  address_line_1, address_line_2, city, state, zip_code
  billing_email
  timezone (IANA, nullable → falls back to tenant)
  stripe_customer_id, accounting_customer_id
  is_active, created_at

  → has many: Retainer, Invoice, ClientInvitation

RetainerTemplate
  id, tenant_id, name, description
  included_hours, rate_per_hour
  overage_rate
  overage_tiers (JSON: [{from_hours, to_hours, rate}])
  rollover_enabled, rollover_cap_type (PERCENTAGE|FIXED)
  rollover_cap_value, rollover_expiry_months
  travel_time_billing, travel_time_rate
  travel_expenses_enabled, mileage_rate, per_diem_rate
  is_active, created_at

Retainer
  id, tenant_id, client_id, template_id (nullable)
  name, status (ACTIVE|PAUSED|EXPIRED|CANCELLED)
  included_hours, rate_per_hour
  overage_rate
  overage_tiers (JSON)
  rollover_enabled, rollover_cap_type, rollover_cap_value
  rollover_expiry_months
  travel_time_billing, travel_time_rate
  travel_expenses_enabled, mileage_rate, per_diem_rate
  timezone (IANA, inherited from tenant, overridable)
  billing_cycle (MONTHLY|BIWEEKLY)
  billing_day, start_date, end_date (nullable)
  created_at

RetainerPeriod
  id, retainer_id
  period_start, period_end
  included_hours, rollover_hours_in, rollover_hours_out, rollover_expiry_date
  used_hours (computed/cached), overage_hours (computed/cached)
  status (OPEN|CLOSED|BILLED)
  created_at

  → This is the billing-period bucket that tracks allocation + usage for monthly or biweekly retainers
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
  is_billable, is_travel_time
  invoice_id (nullable — links entry to invoice when billed)
  status (DRAFT|SUBMITTED|APPROVED)
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

AuditLog
  id, tenant_id, user_id (nullable), action
  entity_type, entity_id, metadata
  ip_address, user_agent, created_at
```

---

## 6. Timezone Strategy

### 6.1 Core Principle: Store UTC, Display Local

```
GOLDEN RULE:
  - Database: ALL timestamps stored as UTC (timestamptz in PostgreSQL)
  - Server: ALL logic runs against UTC
  - Client: ALL display converted to user's/client's local timezone
  - Billing: Cycle boundaries calculated in the RETAINER's timezone, then converted to UTC
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
                   period boundaries for monthly and biweekly billing.
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
Both monthly and biweekly billing boundaries depend on the retainer timezone.

For a retainer with timezone = "America/Denver" (UTC-7 / UTC-6 DST):
  March period = 2025-03-01T00:00:00 America/Denver → 2025-03-01T07:00:00Z
            to   2025-04-01T00:00:00 America/Denver → 2025-04-01T06:00:00Z (DST shift!)

For a biweekly retainer:
  - Period boundaries are derived from the retainer timezone
  - The system can calculate Sunday-ending two-week periods
  - Travel/overage can be deferred to a following invoice depending on billing configuration

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

import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

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

// Calculate biweekly billing boundaries in a timezone
function getBiweeklyPeriodBoundary(date: Date, timezone: string): {
  startUtc: Date;
  endUtc: Date;
  localStart: Date;
  localEnd: Date;
}

// Enumerate biweekly periods across a range
function getBiweeklyPeriods(startDate: Date, endDate: Date, timezone: string): Array<...>
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

### 7.1 Billing Cycle Engine (Monthly + Biweekly)

```
For monthly retainers, on billing day (per retainer):
1. Close current RetainerPeriod
   a. Calculate total used_hours from TimeEntries
   b. Calculate overage_hours (used - included - rollover_in)
   c. Apply tiered overage rates

2. Generate Invoice
   a. Line item: Monthly retainer fee (included_hours × rate)
   b. Line item(s): Overage from current closed period
   c. Add approved billable expenses not yet invoiced
   d. Optionally push downstream to payment/accounting systems

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

For biweekly retainers:
1. Determine the correct two-week period using retainer timezone
2. Link non-travel billable entries to the current invoice
3. Defer travel time and configured overage charges to a follow-up invoice path
4. Export period timesheets in CSV/HTML/Excel formats when needed
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
2. Generate `Invoice` with line items: retainer fee + overage + approved billable expenses
3. Process rollover: `remaining = included_hours + rollover_in - used_hours`
   - Apply cap: `rollover_out = min(remaining, cap_percentage × included_hours)`
   - Set `rollover_expiry_date` (DATE field, evaluated in retainer timezone)
4. Open new `RetainerPeriod` with `rollover_hours_in` from previous period

#### Biweekly Billing Pattern
- `billing_cycle = BIWEEKLY` changes how the period is derived and when invoices are created
- Time entries can be linked directly to an in-progress invoice for the active biweekly period
- `is_travel_time = true` entries can be held back for a separate follow-up invoice
- Dedicated timesheet exports support billing review and client-facing period summaries

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
- **Account Lockout**: Implemented with failed-attempt counters and temporary lockout windows
- **MFA**: Azure AD B2C integration planned for SaaS phase

### Data Protection

- **PII Encryption**: OAuth token fields are modeled in `IntegrationConnection`; encryption-at-rest should be enforced by implementation/deployment policy
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
- **CSRF**: Protect state-changing browser flows with same-site cookies and explicit verification where cross-origin submission is possible

### Data Retention & Privacy

- **Soft Deletes**: Use `isActive` flags for user-facing deletions
- **Hard Deletes**: Implement after retention period (7 years for financial data)
- **Data Export**: Provide client data export functionality (GDPR/privacy compliance)
- **PII Minimization**: Collect only necessary client information

### Rate Limiting

Implemented in Node.js route handlers using Redis-backed sliding windows:
```typescript
const rateLimit = {
  timeEntries: 100, // per hour per tenant
  invoices: 50,
  api: 200, // per hour per tenant
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
├── /auth
│   ├── /[...nextauth]                 NextAuth route
│   ├── /setup                         public tenant bootstrap
│   ├── /tenants                       current-user tenant lookup
│   ├── /magic-link                    client magic-link issue
│   ├── /magic-link/verify             client magic-link verification
│   ├── /invitations/[token]           team invite verification
│   ├── /client-invitations/[token]    client invite verification
│   └── /client-invitations/[token]/accept
│
├── /audit-logs
│   └── GET /                          admin audit log retrieval
│
├── /billing
│   ├── POST /cycle                    trigger billing cycle
│   ├── POST /generate-invoice         generate invoice for a period
│   ├── POST /init-period              initialize/open period
│   └── GET  /check-low-hours          low-hours checks / alerts
│
├── /categories
│   ├── GET /                          list time categories
│   └── POST /                         create time category
│
├── /clients
│   ├── GET /                          list clients
│   ├── POST /                         create client
│   ├── GET /[id]                      get client detail
│   ├── PATCH /[id]                    update client
│   └── POST /[clientId]/invite        invite client to portal
│
├── /expense-categories
│   ├── GET /                          list expense categories
│   ├── POST /                         create expense category
│   ├── PATCH /[id]                    update expense category
│   └── DELETE /[id]                   deactivate/delete expense category
│
├── /expenses
│   ├── GET /                          list expenses
│   ├── POST /                         create expense
│   ├── PATCH /[id]                    update expense
│   ├── DELETE /[id]                   delete expense
│   ├── POST /[id]/submit              submit for approval
│   ├── POST /[id]/approve             approve expense
│   ├── POST /[id]/reject              reject expense
│   ├── POST /[id]/reimburse           mark reimbursed
│   ├── GET  /[id]/documents           list documents
│   ├── POST /[id]/documents           upload document
│   └── DELETE /[id]/documents/[documentId]
│
├── /integrations
│   ├── GET /                          list tenant integrations
│   ├── GET /connect?provider=...      OAuth initiation
│   ├── GET /callback?provider=...     OAuth callback
│   └── DELETE /[id]                   disconnect integration
│
├── /invitations
│   └── POST /send                     send team invitation
│
├── /invoices
│   ├── GET /                          list invoices
│   ├── GET /[id]                      invoice detail
│   ├── POST /[id]/send                send invoice
│   ├── GET /[id]/pdf                  invoice PDF/export
│   ├── POST /[id]/payment-link        create Checkout Session or Payment Intent
│   └── POST /[id]/pay                 manual payment record
│
├── /onboarding
│   └── GET|POST /status               onboarding status / completion
│
├── /reports
│   ├── GET /utilization
│   ├── GET /profitability
│   ├── GET /aging
│   └── GET /forecast
│
├── /retainer-periods
│   └── GET /                          list periods for a retainer
│
├── /retainers
│   ├── GET /                          list retainers
│   ├── POST /                         create retainer
│   ├── GET /[id]                      get retainer + current state
│   └── PATCH /[id]                    update retainer
│
├── /settings
│   ├── GET /                          tenant settings
│   └── PUT /                          update tenant settings
│
├── /stripe
│   └── POST /webhook                  Stripe webhook receiver
│
├── /templates
│   ├── GET /                          list retainer templates
│   └── POST /                         create retainer template
│
├── /tenants
│   └── GET /timezone                  tenant timezone helper
│
├── /time-entries
│   ├── GET /                          list entries
│   ├── POST /                         create standard entry
│   ├── PATCH /[id]                    update entry
│   ├── DELETE /[id]                   delete entry
│   └── POST /timer                    timer entry endpoint
│
├── /time-entries-biweekly
│   └── POST /create                   biweekly-aware time entry creation
│
├── /timesheet
│   └── POST /export                   CSV / HTML / Excel export
│
└── /users
    ├── GET /                          list users
    ├── POST /                         create user
    └── PATCH /[id]                    update user
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
│                      │ - Route handlers       │  │
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
│  │ Standalone worker process (BullMQ)       │   │
│  │ - Billing cycle cron / repeatable jobs   │   │
│  │ - Period closing + rollover processing   │   │
│  │ - Invoice generation jobs                │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  External:                                       │
│  ├── Stripe API (payments, invoicing)            │
│  ├── QBO / Xero API (accounting OAuth + sync)    │
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

- **tenant_id on every table** — queries, invites, onboarding, settings, reports, and billing are already tenant-scoped.
- **Azure AD B2C** — swap in for auth when ready; supports custom signup flows, MFA, social login.
- **Subdomain routing** — admin and landing shells are already subdomain-aware via Next.js middleware; per-tenant domains can build on the same pattern.
- **Stripe Connect** — future enhancement if each tenant should own its payment account.
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
- ✅ Client invitation acceptance flow

### Phase 4 — Accounting Integration (Weeks 9–11)
- ✅ OAuth connection flow for QBO/Xero
- Customer sync (future expansion)
- Invoice push (app → accounting software)
- Payment webhook sync (accounting → app)

### Phase 5 — Polish & Reporting (Weeks 12–14) ✅ COMPLETE
- ✅ Utilization and profitability reports
- ✅ Aging invoices dashboard
- ✅ Forecasting
- ✅ Email notifications (invoice sent, payment received, retainer low)
- ✅ Timer function for time tracking
- ✅ Audit logging foundation
- ✅ Tenant onboarding flow

### Phase 5.5 — Billing Expansion ✅ PARTIAL
- ✅ Biweekly billing schema support
- ✅ Biweekly period calculation helpers
- ✅ Travel-time tracking and deferred invoicing path
- ✅ Timesheet export endpoints
- ⏳ Full worker automation for biweekly cycle parity with monthly billing

### Phase 6 — SaaS Prep (Future)
- Expanded tenant membership / cross-tenant access model
- Tenant subscription billing (bill the tenant for using Ancora)
- Subscription billing (Stripe for the app itself)
- Richer admin super-dashboard and ops tooling

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
