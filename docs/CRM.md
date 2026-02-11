# CRM for Individual & Business Customers

## Context

MARCO currently has no persistent customer records. Customer data (name, email, phone, payment details) is captured only when a quote or bulk estimate is accepted, and stored as flat fields on each quote/bulkQuote document. There's no way to view a customer's history across multiple transactions, add notes, or manage contacts as first-class entities. This CRM adds a lightweight `customers` collection with auto-linking to quotes, a unified admin UI, and a migration script for existing data.

---

## 1. Data Model — `customers` Collection

```typescript
interface Customer {
  type: "individual" | "business";
  name: string;                        // customerName or contactName
  email: string;                       // Normalized (lowercase, trimmed) — used for dedup
  phone: string | null;
  businessName: string | null;         // Business-only
  shippingAddress: string | null;
  paymentMethod: "payid" | "bank_transfer" | null;
  payIdPhone: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  quoteIds: string[];                  // Linked individual quote IDs
  bulkQuoteIds: string[];              // Linked bulk quote IDs
  totalQuotes: number;                 // Denormalized count
  totalValueNZD: number;               // Denormalized sum
  lastActivityAt: string;              // ISO string
  notes: { id: string; text: string; createdBy: string; createdAt: string }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Backlink field added to existing collections: `quotes/{id}.customerId` and `bulkQuotes/{id}.customerId`.

---

## 2. New Files

| File | Purpose |
|------|---------|
| `lib/customer-link.ts` | `findOrCreateCustomer()` helper — email-based dedup, creates or updates customer, links quote/bulkQuote ID |
| `app/api/admin/customers/route.ts` | `GET` (list with type filter + search) / `POST` (manual create) |
| `app/api/admin/customers/[id]/route.ts` | `GET` (detail with linked quotes) / `PUT` (update contact info) |
| `app/api/admin/customers/[id]/notes/route.ts` | `POST` (add note) / `DELETE` (remove note) |
| `app/admin/customers/page.tsx` | Customer list — type filter tabs, search, table, pagination |
| `app/admin/customers/[id]/page.tsx` | Customer detail — contact card, payment card, quote history, notes |
| `scripts/migrate-customers.ts` | One-time migration from existing quotes/bulkQuotes |

## 3. Modified Files

| File | Change |
|------|--------|
| `app/admin/layout.tsx` | Add "Customers" link (with `ContactRound` icon) to `sidebarLinks` before Settings |
| `app/admin/page.tsx` | Add Customers card to dashboard |
| `app/api/quote/[id]/route.ts` | Call `findOrCreateCustomer()` on quote acceptance, write `customerId` back to quote |
| `app/api/business/estimate/[id]/route.ts` | Call `findOrCreateCustomer()` on bulk estimate acceptance, write `customerId` back to bulkQuote |
| `app/admin/quotes/[id]/page.tsx` | Add "View Customer Profile" button in the Customer Details card |
| `app/admin/bulk-quotes/[id]/page.tsx` | Add "View Customer Profile" button in the Contact Details card |
| `app/api/admin/quotes/[id]/route.ts` | Include `customerId` in GET response |
| `app/api/admin/bulk-quotes/[id]/route.ts` | Include `customerId` in GET response |
| `firestore.indexes.json` | Add composite index: `customers(type ASC, updatedAt DESC)` |

---

## 4. Auto-Linking Logic (`lib/customer-link.ts`)

When a quote or bulk estimate is **accepted**:
1. Normalize the customer email (lowercase, trim)
2. Query `customers` where `email == normalizedEmail`
3. If found: update contact info with latest values, append quoteId/bulkQuoteId, increment stats
4. If not found: create new customer doc with type, contact info, linked quote, initial stats
5. Write the `customerId` back to the quote/bulkQuote document
6. Wrapped in try/catch so failures don't block quote acceptance

---

## 5. Customer List Page (`/admin/customers`)

Layout matches existing admin list pages (quotes, partners):
- Type filter tabs: All | Individual | Business
- Search input (name, email, business name)
- Table columns: Name, Email, Type (badge), Quotes, Total Value, Last Activity, Created
- Clickable rows navigate to `/admin/customers/[id]`
- "Add Customer" button opens a dialog for manual creation (type, name, email, phone, business name)
- Client-side pagination (PAGE_SIZE = 25)

## 6. Customer Detail Page (`/admin/customers/[id]`)

- **Contact Info card**: Name, email, phone, business name (if business), shipping address — editable via Edit button
- **Payment Details card**: Payment method, PayID/bank details
- **Quote History card**: Toggle between Individual Quotes and Bulk Quotes tables, each row links to the respective detail page
- **Notes card**: Chronological list of notes (text, author, date), textarea + "Add Note" button, delete button per note

---

## 7. Implementation Order

1. **Foundation**: `lib/customer-link.ts`, API routes (`customers/route.ts`, `[id]/route.ts`, `notes/route.ts`)
2. **Admin UI**: List page, detail page, sidebar + dashboard updates
3. **Auto-linking**: Hook into quote acceptance and bulk estimate acceptance
4. **Cross-linking**: Add `customerId` to admin API responses, "View Customer" links on quote/bulkQuote detail pages
5. **Migration**: Run `scripts/migrate-customers.ts` to backfill from existing data

---

## 8. Migration

Run the migration script to backfill customer records from existing accepted quotes and bulk quotes:

```bash
npx tsx scripts/migrate-customers.ts
```

The script is idempotent — it skips quotes that already have a `customerId` and updates existing customers rather than creating duplicates.

---

## 9. Verification

- Create a quote as a consumer, accept it → verify customer auto-created in Firestore and visible in `/admin/customers`
- Accept a second quote with the same email → verify it links to the existing customer (no duplicate)
- Create a bulk estimate, accept it → verify business customer created with `type: "business"`
- Add/delete notes on a customer detail page
- Manually create a customer via the dialog
- Click "View Customer" from quote detail page → navigates correctly
- Run migration script → existing accepted quotes/bulkQuotes generate customer records
- Search and filter customers by type, name, email
