# Changelog

All notable changes to Ancora will be documented in this file.

## [Unreleased]

### Added - UI/UX Improvements & Settings Management

#### Timezone Management
- **UI**: Timezone dropdown selector on client creation page with 30+ IANA timezones
- **UI**: Timezone dropdown selector on settings billing preferences (admin-editable)
- **API**: `GET /api/settings` to retrieve tenant company settings and preferences
- **API**: `PUT /api/settings` to update company information and timezone

#### Settings Page (Full Implementation)
- **Page**: `/dashboard/settings` page for admin company configuration
- **Sections**: 
  - Company Information (name, email, phone, website, address, tax ID)
  - Billing Preferences (timezone, logo URL)
  - Account Information (read-only tenant ID, name, last updated)
- **Features**: Admin-only access, form validation, success/error notifications

#### Time Entry Form Enhancements
- **UI**: Retainer selector dropdown on time entry creation form
- **Feature**: Dynamic retainer loading based on selected client
- **Feature**: Shows only ACTIVE retainers for selected client
- **Feature**: Automatically captures client timezone for time entry

#### Select Component
- **Component**: New `src/components/ui/select.tsx` (Radix UI primitives)
- **Features**: Accessible dropdown component with smooth animations
- **Usage**: Used for timezone, client, and retainer selections across forms

### Added - Biweekly Billing System
- **Schema**: New `BillingCycle` enum (MONTHLY, BIWEEKLY) on `Retainer` model
- **Schema**: `billingCycle` field on `Retainer` for period type selection
- **Schema**: `isTravelTime` boolean field on `TimeEntry` for travel time tracking
- **Schema**: `invoiceId` field on `TimeEntry` linking entries directly to invoices
- **Utilities**: `getBiweeklyPeriodBoundary()` function for Sunday-to-Sunday period calculation
- **Utilities**: `getBiweeklyPeriods()` function for date range period enumeration
- **Utilities**: Timezone-aware period boundary calculation based on retainer timezone
- **Invoice Generation**: `generateBiweeklyInvoiceForPeriod()` for biweekly cycles with travel/overage separation
- **Invoice Generation**: `generateOverageInvoiceForPreviousPeriod()` for deferred travel/overage charges
- **Timesheet Export**: CSV export with full period details
- **Timesheet Export**: Excel (.xlsx) export with formatted sheets
- **Timesheet Export**: HTML template for PDF conversion (via puppeteer)
- **Timesheet Export**: `collectTimesheetData()` for role-based time entry visibility
- **API**: `POST /api/timesheet/export` for timesheet downloads in multiple formats
- **API**: Updated `POST /api/time-entries` to support `isTravelTime` flag
- **API**: Updated `PATCH /api/time-entries/[id]` to support travel time editing
- **API**: `POST /api/time-entries/timer` updated with travel time support
- **UI**: Travel time checkbox on new time entry form
- **UI**: Travel time checkbox on edit time entry form
- **UI**: Travel time checkbox on floating timer component
- **UI**: Invoice # column on time entries list
- **UI**: Travel time entries show "Travel – Next Bill" badge
- **UI**: Travel indicator (✈) in duration column for travel entries
- **UI**: `TimesheetExportButton` component with multi-format export options
- **API**: `GET /api/retainer-periods` endpoint for period enumeration
- **Documentation**: Comprehensive `BIWEEKLY_BILLING_GUIDE.md` with implementation details

### Changed
- **Time Entry Form**: Now captures travel time when creating entries
- **Invoice Display**: Shows linked time entry invoice numbers
- **Period Calculation**: Supports both monthly and biweekly cycles based on retainer config
- **Billing Logic**: Separates retainer hours (current invoice) from travel/overage (next invoice)

### Fixed
- Fixed syntax errors in `src/app/dashboard/clients/new/page.tsx`
- Fixed malformed JSX in `src/app/dashboard/clients/[id]/edit/page.tsx`
- Fixed broken form structure in `src/app/dashboard/settings/page.tsx`
- Removed invalid `address` field selections from Client queries
- Added missing `Textarea` import to settings page
- **Address Entry**: Replaced legacy single-line `address` field with full structured form across the site
  - New client form now collects Address Line 1, Address Line 2, City, State, Zip Code via `AddressForm` component
  - Edit client form now renders `AddressForm` pre-populated with existing structured address data
  - Settings page now has controlled Address Line 1, Address Line 2, City/State/Zip inputs in Company Information section
  - `POST /api/settings` and `PUT /api/settings` Zod schema now validates individual address fields (`addressLine1`, `addressLine2`, `city`, `state`, `zipCode`) instead of legacy `address` string

### Deployment Notes
- Run `npm run db:generate` after schema changes to regenerate Prisma Client types
- Run `npm run db:push` to apply schema changes to database
- Optional: `npm install xlsx` for Excel export support (will fail gracefully if not installed)
- Production: Consider configuring `puppeteer` for PDF timesheet generation

---

## Configuration

### Enable Biweekly Billing
To enable biweekly billing for a retainer:

```typescript
await prisma.retainer.update({
  where: { id: retainerId },
  data: {
    billingCycle: 'BIWEEKLY',
    billingDay: 0,  // Always Sunday for biweekly
  },
})
```

### Timezone Handling
Biweekly periods are calculated in this priority:
1. Retainer timezone (if set on retainer)
2. Client timezone (if set on client)
3. Tenant timezone (fallback)

---

## API Changes

### New Endpoints
- `POST /api/timesheet/export` - Export timesheet in CSV/Excel/PDF format
- `GET /api/retainer-periods` - List periods for a retainer
- `GET /api/settings` - Retrieve tenant company settings and billing preferences (admin only)
- `PUT /api/settings` - Update company information, timezone, and billing preferences (admin only)

### Updated Endpoints
- `POST /api/time-entries` - Now accepts `isTravelTime` boolean
- `PATCH /api/time-entries/[id]` - Now accepts `isTravelTime` boolean
- `POST /api/time-entries/timer` - Now accepts `isTravelTime` boolean

---

## Breaking Changes
None. All changes are backward compatible. Monthly billing remains the default.

---

## Migration Guide

No database migration script needed. Schema changes are applied via Prisma:

```bash
npm run db:generate  # Regenerate types
npm run db:push      # Apply schema to database
```

---

## Known Limitations
- PDF timesheet export requires external puppeteer setup (not yet implemented in template)
- Excel export requires optional `xlsx` package (defaults to HTML fallback if not installed)
- Submission deadline (Monday 10 AM) is calculated but not enforced via business logic

---

## Future Enhancements
- [ ] BullMQ biweekly billing job (currently monthly)
- [ ] Client portal timesheet view
- [ ] Accounting software sync for travel/overage line items
- [ ] Puppeteer PDF generation for timesheets
- [ ] Timesheet attachment to invoice PDF
- [ ] Travel time report and analytics

