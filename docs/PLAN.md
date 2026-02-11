# MARCO — Trade-In Program Plan

## Vision

A consumer and business-facing web app where users in **Australia and New Zealand** can browse trade-in values for their phones and request quotes. Backed by an internal pricing engine, IMEI-based device identification, and a competitive price monitoring system.

---

## 1. Core User Flow

### Consumer / Business Seller

```
Enter IMEI or select device manually
        │
        ▼
Device identified (make, model, storage)
        │
        ▼
Select condition / answer grading questions
        │
        ▼
Instant quote displayed (AUD or NZD based on region)
        │
        ▼
Accept quote → provide contact details → receive shipping instructions
```

### Key UX Decisions

- **IMEI-first approach**: Differentiate from competitors who rely on manual model selection. User enters IMEI → we auto-detect make, model, and storage. Manual fallback if IMEI lookup fails or user prefers browsing.
- **Region detection**: Auto-detect AU vs NZ (IP-based or user toggle). Display prices in AUD or NZD accordingly.
- **Instant quote**: No login required. Friction-free. Quote valid for X days.

---

## 2. Competitive Landscape

### Mobile Monster (mobilemonster.com.au)
- **Grading**: 3 tiers — As New, Working, Dead
- **Flow**: Select device → select condition → instant quote
- **Payment**: EFT within 3–5 business days
- **Shipping**: Free prepaid Australia Post satchel
- **Differentiators**: 5% price beat guarantee (up to $30), Phonecheck Diagnostics inspection, Trustpilot reviews
- **Coverage**: iPhone, Samsung, Google, OPPO, Huawei, Xiaomi + tablets, watches, laptops, gaming
- **Benchmark**: iPhone 16 Pro Max 256GB ≈ AU$1,130 (working)

### OzMobiles (sell.ozmobiles.com.au)
- **Grading**: 4 tiers — As New, Working, Faulty, Dead
- **Flow**: Search device → select condition → instant quote (built on Bubble.io)
- **Payment**: Within 24 hours (claimed) to 3–5 business days
- **Shipping**: Free postage or drop-off at Melbourne CBD store
- **Differentiators**: Claims 20%+ higher payouts than competitors, Australian-owned, physical storefront
- **Coverage**: Primarily phones

### Key Takeaways
- Both use simple 3–4 tier grading (not the A–E system in our price list)
- Both show instant quotes without requiring login
- Both offer free shipping + risk-free returns
- Price beat guarantees are common — competing on price alone is a race to the bottom
- Neither uses IMEI-based identification (manual selection only)
- Neither serves NZ market directly

---

## 3. Grading System

### Internal Grading (Price List)
Our `FP-2B` price list uses **5 grades: A, B, C, D, E** — this is our buy price from channel partners.

### Consumer-Facing Grading (5 Grades)
All 5 grades are exposed to the consumer. Straightforward descriptions — no hidden mapping.

| Grade | Label | Description |
|---|---|---|
| **A** | Excellent | Excellent condition — like new, no visible wear |
| **B** | Good | Good condition — minor wear, light scratches |
| **C** | Fair | Functional issues or noticeable wear |
| **D** | Screen Issues | Screen problems — burn-in, dead pixels, touch issues, cracked glass |
| **E** | No Power | Device does not turn on |

### Grading Question Flow
Single-path question that routes directly to a grade:

```
Does the phone turn on?
├── No → Grade E (No Power)
└── Yes
    └── Does the screen have issues? (burn-in, dead pixels, touch problems, cracked glass)
        ├── Yes → Grade D (Screen Issues)
        └── No
            └── Any functional issues or noticeable wear? (buttons, speaker, camera, dents, deep scratches)
                ├── Yes → Grade C (Fair)
                └── No
                    └── Any minor wear or light scratches?
                        ├── Yes → Grade B (Good)
                        └── No → Grade A (Excellent)
```

This decision tree is simple, deterministic, and maps 1:1 to the price matrix. No ambiguity between grades.

---

## 4. IMEI Integration

### What IMEI Gives Us
The first 8 digits (TAC — Type Allocation Code) identify:
- Brand / manufacturer
- Model name
- Sometimes storage variant

### Approach: Self-Building TAC Cache

Use [imei.info](https://dash.imei.info) API (V5) as the source, with a local Firestore cache that grows over time. Every TAC we pay to look up once is free forever after. Endpoint: `GET https://dash.imei.info/api/check/0/?API_KEY={key}&imei={imei}` (Service 0 = "Basic IMEI Check", $0.02/lookup). Supports async polling for slow lookups.

```
User enters IMEI
        │
        ▼
Validate (15 digits + Luhn checksum)
        │
        ▼
Extract TAC (first 8 digits)
        │
        ▼
Check local TAC table (Firestore)
├── Hit → return device instantly (free, ~50ms)
└── Miss → query imei.info API
            │
            ▼
      Parse make/model → match to device library
      (exact match → model contains → fuzzy token matching)
            │
            ▼
      Store TAC → device mapping in Firestore
            │
            ▼
      Return device to user
      (if storage unknown, return storage options for user to pick)
```

### TAC Table Schema (Firestore)

```
tacLookup/
  {tac}/                    # 8-digit TAC as document ID
    make: string            # e.g., "Apple"
    model: string           # e.g., "iPhone 16 Pro Max"
    storage: string?        # e.g., "256GB" (if available from API)
    deviceId: string?       # Matched device from our library (null if no match)
    source: string          # "imei.info" | "cache"
    createdAt: timestamp
```

### Fallback: Manual Selection
If IMEI lookup returns a device not in our price list, or the user doesn't have their IMEI:
- Fall back to manual browse: Make → Model → Storage
- Still offer IMEI as the primary/fastest path

### Future Enhancements
- **Blacklist checking**: imei.info can flag stolen/lost devices — protects against buying hot phones
- **Storage detection**: Some TAC lookups return storage; where unavailable, user selects from matching variants

---

## 5. Currency & Pricing

### Internal Pricing
- All prices managed in **NZD** (source of truth from NZ channel partner)
- `FP-2B.csv` contains NZD buy prices by grade

### Consumer Pricing
- Need a **margin layer** on top of buy prices to set consumer-facing quotes
- Display in **AUD** for Australian users, **NZD** for NZ users
- FX conversion: [freecurrencyapi.com](https://freecurrencyapi.com) free tier (5,000 req/month). Endpoint: `GET https://api.freecurrencyapi.com/v1/latest?apikey={key}&base_currency=NZD&currencies=AUD`
- Apply a buffer/spread on FX to protect against rate volatility

### Pricing Architecture
```
Base buy price (NZD, from price list)
        │
        ▼
Apply margin rules (% markdown from buy price = consumer quote)
        │
        ▼
Convert to display currency (AUD/NZD)
        │
        ▼
Round to nearest $5 or $10 for clean display
```

### Margin Considerations
- Consumer quote = what we pay the consumer (our cost)
- Our profit = resale price minus consumer quote minus logistics
- Different margins per grade, brand, and device age

---

## 6. Post-Quote Flow

### Consumer Journey After Grading

```
Quote displayed (device + grade + price)
        │
        ▼
Consumer accepts quote
        │
        ▼
Collect details:
  - Name, email, phone
  - Payment method: PayID (mobile number) or bank transfer (BSB + account number)
        │
        ▼
Confirmation page + email with:
  - Quote reference number
  - Shipping instructions (post to our address)
  - Quote validity period
        │
        ▼
Consumer ships device to us
        │
        ▼
We receive device → status: "received"
        │
        ▼
Inspection / re-grading
├── Grade matches quote → pay consumer → status: "paid"
└── Grade differs → revised offer
    ├── Consumer accepts revised price → pay consumer → status: "paid"
    └── Consumer declines → return device free of charge → status: "returned"
```

### Payment

| Method | Details | Market |
|---|---|---|
| **PayID** | Consumer provides mobile number, we pay instantly via PayID | Australia |
| **Bank transfer** | Consumer provides BSB + account number + account name | Australia & NZ |

### Shipping (MVP)

For MVP, consumer ships at their own cost to a provided address. No prepaid satchel initially.

Future consideration: free prepaid satchels (Australia Post / NZ Post) to match competitors and reduce friction.

### Quote Validity

Quotes valid for **14 days** from creation. After expiry, consumer can re-quote (price may have changed).

### Inspection & Re-Grading

When a device arrives, admin inspects and records:
- Actual grade (A–E)
- Inspection notes
- If grade differs from quoted grade, a revised price is calculated automatically from the price matrix
- Consumer is notified and can accept the revised price or request the device back

---

## 7. Business Trade-In Flow

Businesses get all three options, doubling as an **estimator tool** — upload a manifest, see indicative values, no commitment until they ship.

### Option A: Manifest Upload (Bulk Estimate)

```
Business uploads CSV/XLSX manifest (model + storage + quantity, optionally IMEI list)
        │
        ▼
System matches devices to library:
├── Exact match → auto-matched
├── Fuzzy match (confidence > threshold) → auto-matched with flag
└── No match → flagged for manual resolution
        │
        ▼
Indicative quote generated at assumed grade (e.g., Grade C)
  - Per-device breakdown visible
  - Total lot value displayed
  - Exportable as PDF/CSV
        │
        ▼
Business reviews estimate
├── Walk away (estimator use only — no commitment)
└── Accept → provide contact + payment details → ship devices
            │
            ▼
      We inspect + grade each device individually
            │
            ▼
      Final offer = sum of actual per-device prices → pay business
```

### Option B: Ungraded Flat Rate

Business provides a device count and general description ("50 mixed iPhones, mostly 13 and 14 series"). We quote a blended $/unit based on historical grade distribution. Fastest path for large lots where the business wants a ballpark.

### Option C: Self-Service Bulk Grading

Business grades each device themselves using the same A–E decision tree as consumers. Most accurate upfront quote, suitable for smaller batches (< 20 devices) or businesses with existing grading processes.

### Fuzzy Matching for Manifest Imports

Business manifests often use internal shorthand. Matching strategy:

```
Raw input string (e.g., "IPH1164G")
        │
        ▼
1. Normalize: lowercase, strip spaces/punctuation
        │
        ▼
2. Extract tokens: known brands, model patterns, storage values (64/128/256/512/1TB)
        │
        ▼
3. Match against device library:
   ├── Exact match on modelStorage → confidence: high
   ├── Alias table hit → confidence: high
   ├── Token similarity score > 0.8 → confidence: medium (auto-match, flag for review)
   └── Score < 0.8 → confidence: low (manual resolution required)
```

**Alias table** (Firestore, grows over time):

```
deviceAliases/
  {aliasId}/
    alias: string           # e.g., "IPH1164G", "IP11-64"
    deviceId: string        # Matched device in our library
    createdBy: string       # "auto" or admin userId
    createdAt: timestamp
```

When an admin manually resolves a fuzzy match, the alias is saved — next time that shorthand appears, it matches instantly. The alias table gets smarter with every manifest processed.

### Estimator Value Proposition

The estimator is a **sales funnel**:
- Businesses can run scenarios without commitment ("What's 100 iPhone 14s worth at Grade C?")
- Shareable estimate PDFs for internal budget approvals
- Repeat visits build trust and familiarity before first transaction
- No login required for estimate; login required to accept and ship

### Business-Specific Fields (Firestore)

```
bulkQuotes/
  {bulkQuoteId}/
    businessName: string
    contactName: string
    contactEmail: string
    contactPhone: string
    type: "manifest" | "flat_rate" | "self_graded"
    assumedGrade: string        # Grade used for indicative pricing (e.g., "C")
    totalDevices: number
    totalIndicativeNZD: number
    status: "estimated" | "accepted" | "received" | "inspected" | "paid"
    # Payment details (same as consumer)
    paymentMethod: "payid" | "bank_transfer"
    payIdPhone: string?
    bankBSB: string?
    bankAccountNumber: string?
    bankAccountName: string?
    # Timestamps
    createdAt: timestamp
    acceptedAt: timestamp?
    receivedAt: timestamp?
    paidAt: timestamp?

bulkQuotes/{bulkQuoteId}/devices/   # Subcollection: per-device breakdown
  {lineId}/
    rawInput: string?           # Original string from manifest (e.g., "IPH1164G")
    deviceId: string?           # Matched device (null if unresolved)
    matchConfidence: "high" | "medium" | "low" | "manual"
    quantity: number
    assumedGrade: string
    indicativePriceNZD: number  # Per-unit price at assumed grade
    # Post-inspection fields
    actualGrade: string?
    actualPriceNZD: number?
    inspectionNotes: string?
```

---

## 8. Price Comparison / Monitor Tool

### Phase 1 — Internal Tool
Build a dashboard that:
- **Scrapes or manually tracks** competitor prices (Mobile Monster, OzMobiles, trade.com.au, Apple Trade In, Samsung Trade In)
- Compares our consumer-facing quotes against competitors per model/grade
- Highlights where we're **above, at, or below** market
- Flags models where we could be more competitive or where we're leaving money on the table

### Phase 2 — External Widget (If Competitive)
If data shows we're consistently competitive across high-volume models:
- Public-facing comparison page: "Compare our prices vs the market"
- SEO play: rank for "best iPhone trade-in price Australia"
- Trust signal: transparency builds consumer confidence
- Similar to how energy/insurance comparison sites drive conversion

### Data Sources for Competitor Prices
| Competitor | Method |
|---|---|
| Mobile Monster | Scrape quote API (they return JSON for each model/condition) |
| OzMobiles | Scrape Bubble.io app or manual entry |
| Apple Trade In | Apple's public trade-in estimator |
| Samsung Trade Up | Samsung's trade-in page |
| trade.com.au | Scrape listing prices |
| BankMyCell / SellCell | Aggregator APIs or scraping |

### Risks
- Scraping may violate competitor ToS — consider manual entry for MVP
- Prices change frequently — need regular refresh cadence (weekly minimum)
- Comparison only valuable if our device/grade coverage matches competitors

---

## 7. Technical Architecture

### Stack (Already Set Up)
- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Hosting**: Vercel (Next.js) + Firebase
- **Repo**: GitHub

### Design System (Inherited from rhex.app)

To keep `tradein.rhex.app` visually consistent with the parent `rhex.app` brand, the component library and theme are carried over.

#### Component Library

- **shadcn/ui** (Radix UI primitives + Tailwind styling)
- Style: `"default"`, base color: `"neutral"`
- CSS variables enabled for theming
- `cn()` utility using `clsx` + `tailwind-merge` for class merging

#### Color Tokens (HSL via CSS Variables)

| Token | Light Mode | Hex | Usage |
| --- | --- | --- | --- |
| `--primary` | 337 52% 51% | #c93365 | Buttons, links, active states |
| `--accent` | 336 57% 85% | #f1bed4 | Hover states, highlights, badges |
| `--background` | 0 0% 96% | #F5F5F5 | Page background |
| `--foreground` | 0 0% 3.9% | near-black | Body text |
| `--card` | 0 0% 100% | #FFFFFF | Card surfaces |
| `--muted` | 0 0% 96.1% | — | Subtle backgrounds |
| `--destructive` | 0 84.2% 60.2% | red | Errors, delete actions |

Dark mode overrides are defined on `.dark` class — all tokens swap to dark equivalents.

#### Typography

- **Font**: Geist Sans (loaded via `next/font/google`)
- System font stack fallback: `font-sans`

#### Icons

- **Lucide React** — consistent icon set across all pages

#### Spacing & Radius

- Border radius base: `0.5rem` (`--radius` CSS variable)
- Tailwind's default spacing scale

#### Tailwind Config Highlights

- `tailwindcss-animate` plugin for transitions/animations
- Custom `keyframes` and `animation` entries for accordions, dialogs, etc.
- Color palette driven entirely by CSS variables (no hardcoded hex in config)

#### Key Dependencies to Install

```
npx shadcn@latest init
npm install clsx tailwind-merge lucide-react tailwindcss-animate
```

### Data Model (Firestore)

```
devices/                    # Master device library (source of truth)
  {deviceId}/               # Numeric ID (e.g., "37614"), keeps compat with partner data
    make: string            # e.g., "Apple"
    model: string           # e.g., "iPhone 16 Pro Max"
    storage: string         # e.g., "256GB"
    modelStorage: string    # Computed: "iPhone 16 Pro Max 256GB" (for search/display)
    createdAt: timestamp
    updatedAt: timestamp

counters/                   # Auto-increment tracking
  devices/
    nextId: number          # Next available DeviceID (seeded from max existing + 1)

priceLists/                 # Versioned price lists
  {priceListId}/
    name: string            # e.g., "FP-2B"
    effectiveDate: date
    currency: "NZD"
    prices/                 # Subcollection
      {deviceId}/
        gradeA: number
        gradeB: number
        gradeC: number
        gradeD: number
        gradeE: number

quotes/                     # Consumer quote requests
  {quoteId}/
    deviceId: string
    imei: string?           # Optional, if provided
    grade: string           # A/B/C/D/E
    quotePriceNZD: number
    quotePriceDisplay: number
    displayCurrency: "AUD" | "NZD"
    fxRate: number
    status: "quoted" | "accepted" | "shipped" | "received" | "inspected" | "paid" | "revised" | "rejected" | "returned"
    # Customer details (collected on acceptance)
    customerName: string
    customerEmail: string
    customerPhone: string
    # Payment details
    paymentMethod: "payid" | "bank_transfer"
    payIdPhone: string?         # Mobile number for PayID (AU)
    bankBSB: string?            # BSB for bank transfer
    bankAccountNumber: string?  # Account number for bank transfer
    bankAccountName: string?    # Account holder name
    # Inspection (filled by admin after receiving device)
    inspectedGrade: string?     # Actual grade after inspection
    revisedPriceNZD: number?    # If grade differs
    inspectionNotes: string?
    # Timestamps
    createdAt: timestamp
    expiresAt: timestamp
    acceptedAt: timestamp?
    receivedAt: timestamp?
    inspectedAt: timestamp?
    paidAt: timestamp?

competitorPrices/           # Price monitoring
  {entryId}/
    competitor: string
    deviceId: string
    condition: string
    priceAUD: number
    scrapedAt: timestamp

deviceAliases/              # Fuzzy match alias table (grows over time)
  {aliasId}/
    alias: string           # e.g., "IPH1164G", "IP11-64"
    deviceId: string        # Matched device in our library
    createdBy: string       # "auto" or admin userId
    createdAt: timestamp

exchangeRates/              # FX rate cache
  {date}/
    NZD_AUD: number
    AUD_NZD: number
    source: string
```

### Key Pages

| Route | Purpose |
|---|---|
| `/` | Landing page — "Sell your phone" hero, search/IMEI input |
| `/quote` | Quote flow — device confirmation → grading → instant price |
| `/quote/[id]` | Quote result — price displayed, accept/decline |
| `/browse` | Browse all devices & prices (SEO-friendly) |
| `/admin` | Internal dashboard (auth-protected) |
| `/admin/pricing` | Manage price lists, upload CSVs |
| `/admin/quotes` | View/manage incoming quotes |
| `/admin/competitors` | Price comparison dashboard |
| `/admin/devices` | Device library CRUD — browse, create, edit, delete devices |
| `/admin/devices/import` | Bulk CSV/XLSX import for seeding or adding new devices |
| `/business` | Business landing page — estimator tool, manifest upload |
| `/business/estimate` | Upload manifest → review matches → indicative quote |
| `/business/estimate/[id]` | Estimate result — per-device breakdown, total value, export PDF/CSV |
| `/admin/bulk-quotes` | View/manage business bulk quotes + inspection |
| `/admin/aliases` | Manage device alias table (fuzzy match resolutions) |

---

## 8. Build Phases

### Phase 1 — MVP (Core Quote Flow) ✅ Complete

- [x] Initialize design system: shadcn/ui, Tailwind theme (rhex color tokens), Geist Sans font, Lucide icons
- [x] Seed device library from FP-2B CSV into Firestore (584 devices, one-time import via `scripts/seed.ts`)
- [x] Seed price list from FP-2B CSV into Firestore (584 price entries across grades A–E)
- [x] Admin: device library CRUD (browse, search, create, edit, delete) — `/admin/devices`
- [x] Admin: bulk CSV import for devices — `/admin/devices/import`
- [x] Admin: upload/manage price lists (CSV) — `/admin/pricing` + `/admin/pricing/[id]`
- [x] Consumer landing page with device search (make → model → storage) — `/`
- [x] Guided grading questionnaire (4-step decision tree → grade A–E) — `/quote`
- [x] Instant quote display (NZD) — `/quote/[id]`
- [x] Quote acceptance → collect customer details + payment method (PayID or bank transfer) — `/quote/[id]`
- [x] Confirmation page with quote reference, copy button, and shipping instructions — `/quote/[id]`
- [x] Admin: view/manage quotes dashboard (filter by status, search, pagination) — `/admin/quotes`
- [x] Admin: inspection flow (receive device, re-grade, approve/revise payment, visual stepper) — `/admin/quotes/[id]`

**Deployed**: Preview at `dev` branch on Vercel. 21 routes, all type-checking and building cleanly.

### Phase 2 — IMEI, Currency & Quote Expiry ✅ Complete

- [x] IMEI validation (Luhn checksum) + TAC extraction — `lib/imei.ts`
- [x] IMEI lookup endpoint with imei.info API + self-building TAC cache — `app/api/imei/route.ts`
- [x] 3-strategy device matching (exact → model contains → fuzzy token matching)
- [x] IMEI input on landing page as dual-mode search (name / IMEI tabs) — `app/page.tsx`
- [x] Storage picker when IMEI resolves model but not storage variant
- [x] FX rate engine with Firestore daily cache + freecurrencyapi.com — `lib/fx.ts`
- [x] FX rate public endpoint — `app/api/fx/route.ts`
- [x] AUD/NZD currency toggle in header with localStorage persistence — `lib/currency-context.tsx`
- [x] Currency-aware quote creation (stores NZD base + display price + FX rate) — `app/api/quote/route.ts`
- [x] Quote display in selected currency — `app/quote/[id]/page.tsx`
- [x] Quote expiry detection + re-quote button on expired quotes — `app/quote/[id]/page.tsx`
- [x] Admin: expired badge + currency display on quotes dashboard

**Deployed**: 23 routes, all type-checking and building cleanly.

**Env vars required**: `IMEI_API_KEY` (imei.info) ✅, `FX_API_KEY` (freecurrencyapi.com) ✅

### Phase 3 — Business Estimator ✅ Complete

- [x] Shared fuzzy matching engine extracted to `lib/matching.ts` (alias lookup → exact → substring → token-based)
- [x] Device alias table (`deviceAliases` collection) with auto-save on manual resolution
- [x] Brand alias extraction from raw strings (e.g., "IPH1164G" → Apple iPhone 11 64GB)
- [x] Business manifest upload (CSV + XLSX via SheetJS) with auto-column detection — `/business/estimate`
- [x] Indicative bulk quote with per-device breakdown, confidence badges, currency toggle — `/business/estimate/[id]`
- [x] Manual match resolution UI: search + resolve unmatched devices, saves alias for future matching
- [x] Estimate CSV export — `/api/business/estimate/[id]/export`
- [x] Accept estimate flow: collect business/contact/payment details → status transition
- [x] Admin: bulk quotes dashboard with status tabs, search, pagination — `/admin/bulk-quotes`
- [x] Admin: bulk quote detail + per-device inspection flow with grade/price/notes — `/admin/bulk-quotes/[id]`
- [x] Admin: alias management page (search, add, delete) — `/admin/aliases`
- [x] IMEI route refactored to use shared matching engine from `lib/matching.ts`

**Deployed**: 36 routes, all type-checking and building cleanly.

**New dependency**: `xlsx` (SheetJS) for XLSX parsing.

**Deferred to Phase 3b**: Self-service bulk grading (< 20 devices), PDF export, flat-rate option.
yes
### Phase 4 — Price Monitoring
- [ ] Internal competitor price tracking dashboard
- [ ] Manual price entry (or basic scraping for JSON-based competitors)
- [ ] Side-by-side comparison view: our price vs market per model/grade
- [ ] Alerts when we're significantly above/below market

### Phase 5 — Admin Auth & Security ✅ Complete

- [x] Firebase Auth login page for `/admin` routes (email/password) — `app/admin/login/page.tsx`
- [x] Session cookie auth (`__admin_session`) with custom claims (`admin: true`) — `lib/admin-auth.ts`
- [x] Admin context provider with auth state management — `lib/admin-context.tsx`
- [x] Session API (create/destroy) — `app/api/admin/auth/session/route.ts`
- [x] Auth verification endpoint — `app/api/admin/auth/me/route.ts`
- [x] Middleware protection for all `/admin/*` routes — `middleware.ts`
- [x] Auth guard in admin layout with sign out button — `app/admin/layout.tsx`
- [x] `requireAdmin()` guard on all 14 `/api/admin/*` route files (26 handlers)
- [x] Admin user setup script — `scripts/set-admin.ts`

### Phase 6 — Growth
- [ ] Public price comparison page (if consistently competitive)
- [ ] SEO-optimized browse pages per device model
- [ ] Email notifications for quote status changes
- [ ] Shipping label generation / logistics integration
- [ ] Blacklist/stolen device checking (via imei.info)

---

## 9. Open Questions

1. **Brand name**: Keep "MARCO" or rebrand for consumer-facing? MARCO works as internal codename but may need a consumer brand.
2. **Shipping logistics**: MVP uses consumer-paid shipping. Future: free prepaid satchels via Australia Post / NZ Post?
3. **NZ channel partner relationship**: Are they the sole supplier of buy prices, or will there be multiple price sources?
4. **NZ payment method**: PayID is AU-only. What's the NZ equivalent? Bank transfer covers both markets but is slower.

---

## References

- [Mobile Monster — How It Works](https://mobilemonster.com.au/how-it-works)
- [Mobile Monster — Best Price Guarantee](https://mobilemonster.com.au/best-price-guarantee)
- [OzMobiles — Sell Your Phone](https://ozmobiles.com.au/pages/sellyourphone)
- [OzMobiles — Trade-In Help Centre](https://help.ozmobiles.com.au/hc/en-us/sections/360001464116-OzMobiles-Trade-in)
- [IMEI.info — API Documentation](https://www.imei.info/api/imei/docs/)
- [IMEI.info — IMEI Checker](https://www.imei.info/imei-checker/)
