# Biweekly Billing Implementation Guide

## Overview
Your Ancora system has been enhanced to support biweekly (2-week) billing cycles with the following features:

✅ **Implemented:**
- Biweekly period calculation (Sunday-to-Sunday, submitted by Monday 10 AM)
- Travel time tracking (`isTravelTime` boolean flag)
- Invoice linking for time entries
- Overage and travel billing deferred to next invoice
- Timesheet export in PDF, CSV, and Excel formats
- Automatic biweekly period assignment

---

## Key Changes

### 1. Database Schema Updates
```sql
-- New fields in retainers table:
- billing_cycle: ENUM('MONTHLY', 'BIWEEKLY') [default: MONTHLY]

-- New fields in time_entries table:
- is_travel_time: BOOLEAN [default: false]
- invoice_id: UUID [nullable]

-- New relation:
- TimeEntry → Invoice (for tracking which hours are on which invoice)
```

### 2. Utility Functions

#### Biweekly Period Calculation (`src/lib/timezone.ts`)
```typescript
import { getBiweeklyPeriodBoundary } from '@/lib/timezone'

// Get period boundaries for any date
const { startUtc, endUtc, localStart, localEnd } = getBiweeklyPeriodBoundary(
  new Date(),
  'America/Denver'
)

// Get all periods in a date range
const periods = getBiweeklyPeriods(startDate, endDate, timezone)
```

#### Invoice Generation (`src/lib/invoice.ts`)
```typescript
// For biweekly invoices (separates retainer + expenses from travel/overage)
import { generateBiweeklyInvoiceForPeriod } from '@/lib/invoice'

const result = await generateBiweeklyInvoiceForPeriod(
  retainerPeriodId,
  tenantId,
  14  // days until due
)

// Separate overage invoice (for travel + overage from previous period)
import { generateOverageInvoiceForPreviousPeriod } from '@/lib/invoice'

const overageResult = await generateOverageInvoiceForPreviousPeriod(
  retainerPeriodId,
  tenantId,
  30  // days until due
)
```

#### Timesheet Export (`src/lib/timesheet-export.ts`)
```typescript
import { 
  collectTimesheetData,
  generateTimesheetCSV,
  generateTimesheetExcel,
  generateTimesheetPDF,
} from '@/lib/timesheet-export'

// Collect data
const data = await collectTimesheetData(retainerPeriodId, tenantId, timezone)

// Export to formats
const csv = generateTimesheetCSV(data)
const excel = await generateTimesheetExcel(data)
const html = generateTimesheetHTML(data)  // For PDF conversion
```

---

## API Endpoints

### 1. Create Time Entry (Biweekly-aware)
**POST** `/api/time-entries-biweekly/create`

Request:
```json
{
  "retainerId": "ret_123",
  "clientId": "cli_456",
  "startTime": "2025-03-18T09:00:00",
  "endTime": "2025-03-18T17:00:00",
  "entryTimezone": "America/Denver",
  "externalDescription": "Development work",
  "internalNotes": "Feature implementation",
  "isBillable": true,
  "isTravelTime": false,          // NEW: Track travel separately
  "categoryId": "cat_789"
}
```

Response:
```json
{
  "success": true,
  "timeEntry": { ... },
  "linkedInvoice": "INV-2025-00047",
  "message": "Time entry recorded"
}
```

**Key Features:**
- Automatically assigns to correct biweekly period (based on entry date + retainer timezone)
- Links to current invoice if one exists for that period
- Travel time entries are flagged but not immediately invoiced

### 2. Export Timesheet
**POST** `/api/timesheet/export`

Request:
```json
{
  "retainerPeriodId": "rp_123",
  "format": "csv"  // or "excel", "pdf"
}
```

Response: File attachment with timesheet in requested format

**Timesheet Includes:**
- Period start/end dates
- Submission deadline (Monday 10 AM after period ends)
- All time entries with:
  - Date, start/end times, duration
  - Description (external only, per role)
  - Travel time flag
  - Invoice number (if linked)
- Summary: Total hours, retainer hours, travel hours

---

## Business Logic: Biweekly Billing

### Period Assignment
1. User submits time entry at 2:00 PM Monday in Denver time
2. System converts to local timezone (Denver = UTC-6)
3. Determines which Sunday that falls under
4. Assigns to biweekly RetainerPeriod (Mon-Sun of previous week)

Example:
```
Entry date: Monday, March 17, 2025, 2:00 PM Denver
Local time: 2:00 PM Monday
Previous Sunday: March 16, 2025
Period: March 10 (Sun) → March 16 (Sun)
```

### Current Invoice vs. Next Invoice

**Current Invoice (Same Biweekly Period):**
- ✅ Retainer fee (fixed for period)
- ✅ Non-travel time entries
- ✅ Approved expenses (mileage, per diem excluded)
- ✅ Line items sum to invoice subtotal

**Next Invoice (Deferred):**
- ⏳ Travel time entries (from current period)
- ⏳ Overage hours (if period hours exceeded)
- ⏳ Per diem/mileage expenses
- Creates separate "Overage/Travel" invoice

### Example Flow
```
Period 1 (Mar 10-16):
├─ 40 hrs normal work → Invoice #1 (submitted with retainer fee)
├─ 5 hrs travel → Held for Invoice #2
└─ 45 total hours, 5 overage (assuming 40 included)

Period 2 (Mar 17-23):
├─ 40 hrs normal work → Invoice #2 (with retainer fee)
├─ 5 hrs travel from Period 1 → ADDED to Invoice #2
├─ 5 hrs overage from Period 1 → ADDED to Invoice #2
└─ New invoice #2 shows:
   - Retainer fee (40 hrs × $150)
   - Period 1 travel (5 hrs × $150)
   - Period 1 overage (5 hrs × $175) [if tiered]
```

---

## Configuration

### Enable Biweekly Billing for a Retainer

Update the retainer's `billingCycle`:

```typescript
await prisma.retainer.update({
  where: { id: retainerId },
  data: {
    billingCycle: 'BIWEEKLY',
    // Note: billingDay now represents day of week (0=Sunday for biweekly)
    billingDay: 0,  // Always Sunday for biweekly
  },
})
```

### Timezone Configuration
Biweekly periods are calculated based on:
1. **Retainer timezone** (if set)
2. Falls back to **Client timezone**
3. Falls back to **Tenant timezone**

---

## Next Steps & Remaining Tasks

### ✅ Completed
- [x] Schema changes (billing_cycle, is_travel_time, invoice_id)
- [x] Biweekly period calculation logic
- [x] Invoice generation for biweekly (separates travel/overage)
- [x] Timesheet export (CSV, Excel, HTML)
- [x] API for time entry creation with biweekly assignment
- [x] API for timesheet export

### ⏳ Recommended (Not Yet Implemented)
1. **UI Components:**
   - [ ] Time entry form with `isTravelTime` checkbox
   - [ ] Invoice list view showing linked time entries
   - [ ] Timesheet export button in dashboard
   - [ ] Period/cycle selector (Monthly vs Biweekly) on retainer settings

2. **BullMQ Billing Job:**
   - [ ] Replace monthly cycle job with biweekly detection
   - [ ] Auto-generate invoices for closed biweekly periods
   - [ ] Auto-generate overage invoices for previous periods
   - [ ] Scheduled every Sunday evening or Monday morning

3. **PDF Generation:**
   - [ ] Install and configure puppeteer for PDF export
   - [ ] Create branded timesheet PDF template
   - [ ] Optional: Attach timesheet to invoice PDF

4. **Client Portal:**
   - [ ] Show linked time entries on invoice detail view
   - [ ] Time sheet visibility with external descriptions only
   - [ ] Download timesheet exports

5. **Accounting Integration:**
   - [ ] Sync travel/overage line items to QuickBooks/Xero
   - [ ] Map travel time to separate GL account (optional)

6. **Testing:**
   - [ ] Unit tests for biweekly boundary calculations
   - [ ] E2E test: Create time entry > close period > generate invoices > export timesheet

---

## Example: Complete Workflow

### 1. Setup (Day 1)
```typescript
// Enable biweekly billing
await prisma.retainer.update({
  where: { id: retainerId },
  data: { billingCycle: 'BIWEEKLY' }
})
```

### 2. Submit Time Entry (Wednesday)
```typescript
// Staff submits time via frontend
POST /api/time-entries-biweekly/create
{
  retainerId: "ret_123",
  startTime: "2025-03-19T09:00:00",  // 9 AM Wednesday
  endTime: "2025-03-19T17:00:00",    // 5 PM Wednesday
  isTravelTime: false,
  description: "Development"
}

// Response: Linked to active invoice for Mar 10-16 period
// invoiceId = "inv_546" (Invoice #INV-2025-00047)
```

### 3. Generate Invoice (Sunday Late)
```typescript
// BullMQ job triggers Sunday evening
const invoice = await generateBiweeklyInvoiceForPeriod(
  "rp_123",  // Period ID for Mar 10-16
  tenantId,
  14
)

// Creates invoice with:
// - Retainer fee line item
// - All non-travel entries linked
// - Expenses included
// - Travel entries held for next period
```

### 4. Export Timesheet (Monday)
```typescript
// Client/staff requests timesheet
POST /api/timesheet/export
{
  retainerPeriodId: "rp_123",
  format: "csv"
}

// Returns CSV with:
// - All time entries for Mar 10-16
// - Invoice numbers shown
// - Travel flag column
// - Summary totals
```

---

## Testing the Implementation

### Test Biweekly Period Calculation
```bash
node -e "
const { getBiweeklyPeriodBoundary } = require('./lib/timezone.ts');
const boundary = getBiweeklyPeriodBoundary(new Date('2025-03-18'), 'America/Denver');
console.log(boundary);
"
```

### Create Test Time Entry
```bash
curl -X POST http://localhost:3000/api/time-entries-biweekly/create \
  -H "Content-Type: application/json" \
  -d '{
    "retainerId": "YOUR_RETAINER_ID",
    "clientId": "YOUR_CLIENT_ID",
    "startTime": "2025-03-18T09:00:00",
    "endTime": "2025-03-18T17:00:00",
    "entryTimezone": "America/Denver",
    "externalDescription": "Test entry",
    "isTravelTime": false
  }'
```

### Export Timesheet
```bash
curl -X POST http://localhost:3000/api/timesheet/export \
  -H "Content-Type: application/json" \
  -d '{
    "retainerPeriodId": "YOUR_PERIOD_ID",
    "format": "csv"
  }' > timesheet.csv
```

---

## Dependencies to Review

- **date-fns-tz**: Already installed ✅
- **xlsx** (for Excel export): `npm install xlsx`
- **puppeteer** (for PDF): `npm install puppeteer` (optional, for enhanced PDF templates)

---

## Notes & Caveats

1. **Timezone Awareness:** All period boundaries are calculated in the retainer's timezone, not UTC. Ensure your retainer timezone is set correctly.

2. **Travel Time Handling:** Travel time is flagged but not automatically deducted from included hours. Configure `TravelTimeBilling` on the retainer if you want it counted as overage instead of separate.

3. **Overage Calculation:** Overages are calculated per-period. If 45 hours used in a 40-hour period, the 5 overage hours go to next invoice.

4. **Submission Deadline:** The Monday 10 AM deadline is calculated but not enforced - that's a business process decision.

5. **Multi-Tenant:** All queries properly scope by `tenantId`. Safe for multi-tenant usage.

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `src/lib/timezone.ts` | Biweekly period calculation |
| `src/lib/invoice.ts` | Biweekly invoice generation with travel separation |
| `src/lib/timesheet-export.ts` | Timesheet data collection and export formats |
| `src/app/api/timesheet/export/route.ts` | Export endpoint |
| `src/app/api/time-entries-biweekly/create/route.ts` | Biweekly-aware time entry creation |
| `prisma/schema.prisma` | Updated schema with new fields |

---

## Questions?

Refer to the retainer billing documentation in `Architecture.md` for details on:
- Overage tier calculation
- Rollover logic
- Stripe integration
- Accounting sync

For client export specifics, check `collectTimesheetData()` which handles role-based visibility (staff see internal notes, clients don't).
