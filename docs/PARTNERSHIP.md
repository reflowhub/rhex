# Partnership Channel Plan

## Overview

Expand the trade-in platform beyond direct consumers and self-service business uploads by enabling third-party partners to drive volume through the platform. Four channel models are outlined below — they are not mutually exclusive and can be rolled out incrementally.

---

## Channel 1 — Referral Program

Partners (repair shops, retailers, IT recyclers, telco stores) drive trade-ins through the platform and earn a commission. Two modes:

### Mode A — Referral (Link-Based)
Partner shares a link; customer self-serves end-to-end. The partner never handles the device.

1. Partner signs up and receives a unique referral code / link (e.g. `tradein.rhex.app?ref=PARTNER123`)
2. Consumer or business lands on the platform via that link — referral is tracked via 30-day cookie / URL param
3. Customer completes the trade-in flow themselves (single device or bulk), ships device directly to Reflow Hub
4. When a quote is accepted and paid out, the partner earns a commission (default 5%, admin-adjustable per partner)
5. Partner dashboard shows referred quotes, statuses, and earnings
6. Commissions are paid out monthly (admin can adjust frequency per partner)

### Mode B — Hands-On (Partner Ships Device)

Partner physically receives the device from the customer and ships it to Reflow Hub. Ideal for repair shops taking devices over the counter, retailers offering trade-in at point of sale, or IT recyclers aggregating stock from multiple clients.

1. Partner logs into their dashboard
2. Partner submits trade-ins directly — single device (consumer flow) or bulk (manifest upload / build list)
3. All submissions are tagged to the partner automatically (no referral link needed)
4. Partner manages the lifecycle: views quotes, accepts, arranges shipping to Reflow Hub
5. Reflow Hub pays the partner at the partner rate (below the public consumer payout); partner sets their own price with the end customer and keeps the spread
6. No commission — the partner's margin is the difference between what they charge the customer and what Reflow Hub pays them

**Mode B is essentially the existing `/business/estimate` flow but scoped to a partner account.** The partner sees only their own submissions and partner rates. All quotes carry a `partnerId` field.

### Mode A — Commission Structure (Admin-Configurable)

Applies to **Mode A only**. Each Mode A partner gets a commission profile set by admin. Default is 5% but supports three models — choose per partner:

| Model | How it works | Best for |
|-------|-------------|----------|
| **Flat fee** | Fixed $ amount per device paid out (e.g. $5/device) | Simple referral partners, low volume |
| **Percentage** | % of the payout value (e.g. 5% of quote total) | General partners, scales with device value |
| **Tiered volume** | Rate increases at volume thresholds (e.g. 5% for 1-50 devices/month, 8% for 51-200, 10% for 200+) | High-volume partners, incentivises growth |

**Admin sets this when creating/editing a partner** via the partner management page:
- Commission model selector (flat / percentage / tiered)
- Flat: dollar amount input
- Percentage: rate input (default 5%)
- Tiered: editable threshold table (min qty → rate)
- Preview: "If this partner referred 100x iPhone 13 128GB at Grade C, they'd earn $X"

**Commission calculation** runs automatically when a quote is completed (status → `paid`):
- System reads partner's commission profile
- Calculates earned amount based on model
- Creates a `commissionLedger` entry (partnerId, quoteId, amount, status: pending)
- Visible to admin on the partner detail page and to the partner on their dashboard

**Payout:**

- Monthly by default; admin can adjust frequency per partner
- Admin triggers payouts manually (or on a schedule later)
- Payout groups pending ledger entries, marks them as `paid`, records payout date + reference
- Partner sees payout history on their dashboard

### Mode B — Partner Pricing & Settlement

Applies to **Mode B only**. No commission — Reflow Hub pays the partner less than it would pay a direct consumer, lowering acquisition cost. The partner makes their margin by charging the end customer more than what Reflow Hub pays them.

**How it works:**

1. Admin sets a **partner rate** (default 5% below the public consumer payout, admin-adjustable per partner) when creating/editing the partner
2. Partner sees their partner rates in the dashboard (not Reflow Hub's downstream resale prices, not the public consumer payout)
3. Partner sets their own price with the end customer (their business, their margin — Reflow Hub doesn't see or control this)
4. When the trade-in completes, Reflow Hub pays the partner at the partner rate
5. Partner settles with their customer separately

**Example:** iPhone 13 128GB Grade C

- Public consumer payout: $200 (what a direct consumer would receive)
- Partner rate (5% below): $190 (what Reflow Hub pays the partner)
- Partner charges their customer: $170 (partner's choice)
- Partner's margin: $20 | Reflow Hub saves: $10 vs direct consumer acquisition

**Admin configuration:**

- Partner rate percentage input (default 5% below public consumer payout, adjustable per partner)
- Option for custom per-device pricing overrides (future)
- Preview: "Partner rate for iPhone 13 128GB Grade C = $190 (public payout $200, 5% below)"

**Settlement:**

- Reflow Hub pays the partner after device inspection is complete
- Payment goes to partner's registered payment method (PayID / bank)
- Partner is responsible for paying their customer

### Decisions

- [x] **Payout frequency (Mode A):** Monthly. Admin can edit the frequency per partner.
- [x] **Attribution window (Mode A):** 30-day referral cookie.
- [x] **Settlement model:** Modes have different economics:
  - **Mode A (commission):** Partner earns a commission on each completed trade-in referred via their link. Default 5%, admin-adjustable per partner.
  - **Mode B (partner pricing):** No commission. Reflow Hub pays the partner at a rate below the public consumer payout. Partner sets their own price with the end customer and keeps the spread.
- [x] **Partner pricing (Mode B):** Partners see their partner rates only (not Reflow Hub's downstream resale prices or public consumer payouts). Rate set by admin per partner.
- [x] **Mode separation:** Modes are structurally distinct based on transaction flow, not partner preference:
  - **Mode A** = link-based. Partner sends traffic, customer self-serves end-to-end, partner never touches the device.
  - **Mode B** = hands-on. Partner physically receives the device from the customer and ships it to Reflow Hub.
  - A partner can be registered for both modes, but each transaction is one or the other based on how the device flows.

### Technical scope

- `partners` Firestore collection:
  - name, code, contactEmail, modes (array: ["A"], ["B"], or ["A","B"]), status, createdAt
  - **Mode A fields:** `commissionModel`: "flat" | "percentage" | "tiered", `commissionFlat`, `commissionPercent`, `commissionTiers`, `payoutFrequency` (default "monthly")
  - **Mode B fields:** `partnerRateDiscount`: number (% below public consumer payout)
- `commissionLedger/{id}` collection (Mode A only): partnerId, quoteId/bulkQuoteId, deviceCount, quoteTotal, commissionAmount, status (pending/paid), createdAt, paidAt
- `partnerId` + `partnerMode` ("A" | "B") fields on quotes/bulkQuotes linking back to partner
- **Mode A:** referral tracking — read `ref` query param on landing, store in 30-day cookie/localStorage
- **Mode B:** partner login (Firebase Auth) → partner dashboard at `/partner/dashboard`
  - Single-device submission (reuses consumer quote API with `partnerId`, shows partner rates)
  - Bulk submission (reuses `/api/business/estimate` with `partnerId`, partner rates)
  - Quote management table (filtered to partner's own submissions)
  - Shipping coordination view
- **Admin pages:**
  - Partner management: create/edit partner, set mode(s), configure commission (Mode A) or discount (Mode B)
  - Partner detail: activity feed, commission ledger (Mode A) / settlement history (Mode B), payout history
  - Payout action: select pending entries → mark as paid with reference
- Webhook or email notification to partner on quote status changes + commission/settlement earned

### Partner Portal (`/partner/*`)

One portal for all partners. Features scale based on the partner's mode (A, B, or both). Login via Firebase Auth (email/password or magic link).

**Layout:** Sidebar nav + main content area (same pattern as `/admin`). Header shows partner name + logo.

#### Pages

| Page | Route | Mode A | Mode B | Description |
|------|-------|--------|--------|-------------|
| **Dashboard** | `/partner/dashboard` | Yes | Yes | Overview: total referrals, devices traded, earnings this month, pending payout. Quick stats cards + recent activity feed. |
| **Referral Link** | `/partner/referrals` | Yes | No | Copy-to-clipboard referral link + QR code. Attribution stats: clicks, conversions, conversion rate. |
| **Quotes** | `/partner/quotes` | Yes | Yes | Table of all quotes linked to this partner (via referral or direct submission). Columns: ID, customer/device, status, value, earnings. Status filter tabs. Clickable rows → detail view. |
| **Quote Detail** | `/partner/quotes/[id]` | Yes | Yes | Read-only quote detail (device info, status timeline, pricing). Mode B partners see action buttons (accept, arrange shipping) and partner rates. |
| **Submit Trade-In** | `/partner/submit` | No | Yes | Single-device quote form (reuses consumer flow logic) showing partner rates. Device search → grade select → get quote → accept. All submissions auto-tagged with `partnerId`. |
| **Bulk Estimate** | `/partner/estimate` | No | Yes | Manifest upload + Build List (reuses `/business/estimate` UI). Generates bulk quotes at partner rates. |
| **Bulk Estimate Detail** | `/partner/estimate/[id]` | No | Yes | Per-device breakdown, resolve unmatched, accept estimate (reuses `/business/estimate/[id]` UI). Shows partner prices. |
| **Earnings** | `/partner/earnings` | Yes | Yes | Mode A: commission ledger (quote ID, commission amount, status: pending/paid, date). Mode B: settlement history (quote ID, partner price paid, date). Running totals. |
| **Payouts** | `/partner/payouts` | Yes | Yes | Payout history: date, amount, reference, payment method. Mode A: pending commission balance + next payout date. Mode B: settlement history. |
| **Settings** | `/partner/settings` | Yes | Yes | Contact details, payment method (PayID/bank), notification preferences. Read-only view of commission model (Mode A) or discount rate (Mode B), set by admin. |

#### Sidebar Navigation

```
[Partner Logo]
[Partner Name]

Dashboard
Referral Link
─────────────── (Mode B only)
Submit Trade-In
Bulk Estimate
───────────────
Quotes
Earnings & Payouts
Settings
```

#### Access Control

- Partner auth middleware checks Firebase Auth token + maps to `partners` doc
- All API calls from portal include `partnerId` — queries are scoped to partner's own data
- Mode check: if partner mode is "A", Mode B pages return 404 / redirect to dashboard
- Partner cannot see other partners' data or admin pages

### Effort estimate
- **Mode A only:** Small — referral tracking + partner collection + dashboard + earnings
- **Mode A + B:** Medium — adds submission flows (mostly reusing existing business estimator UI)
- Mode B reuses most of the existing business estimator; main new work is partner auth + scoping

---

## Channel 2 — White-Label / Embedded Widget

Partners embed a trade-in quote widget on their own website. The widget is branded with the partner's logo/colours but powered by the Reflow Hub backend.

### How it works
1. Partner registers and configures their widget (logo, colours, allowed devices, commission)
2. We generate an embed snippet (`<iframe>` or `<script>` tag) for their site
3. Customers interact with the widget on the partner's site — select device, get quote, accept
4. Fulfilment (shipping, inspection, payment) is handled by Reflow Hub
5. Partner earns commission; customer gets paid directly

### Key decisions
- [ ] Embed method: iframe (simpler, isolated) vs JS widget (more integrated, harder)?
- [ ] Branding depth: just logo + colours, or fully white-labelled domain?
- [ ] Device filtering: can partners restrict to certain brands/models?
- [ ] Pricing: partners see Reflow Hub prices, or custom markup/markdown?
- [ ] Shipping: does the customer ship to Reflow Hub directly, or to the partner first?

### Technical scope
- Embeddable quote flow at `/embed/[partnerCode]` with partner-specific theming
- Partner config in Firestore (logo URL, primary colour, allowed device categories, custom intro text)
- CORS / CSP headers to allow iframe embedding from partner domains
- Postmessage API for iframe ↔ parent communication (optional)
- All quotes created via embed tagged with `source: "embed"` and `partnerId`
- Partner dashboard: same as Channel 1, plus embed config + snippet generator

### Effort estimate
- Medium — requires a separate embeddable page variant and theming system
- Consider after Channel 1 is proven

---

## Channel 3 — API Access

Partners integrate directly with the Reflow Hub API to programmatically get quotes, submit devices, and track status. Suited for larger partners with their own systems (e.g. ITAD companies, enterprise IT departments, POS systems).

### How it works
1. Partner applies for API access, receives API key
2. Partner calls our API to: search devices, get prices, create quotes/bulk estimates, check status
3. Fulfilment flow remains the same (ship → inspect → pay)
4. Partner builds their own UI; our API is the backend

### Key decisions
- [ ] Auth method: API key (simple) vs OAuth2 (more secure, supports scopes)?
- [ ] Rate limiting: per-minute / per-day caps? Tiered by partner level?
- [ ] Pricing: do API partners get the same prices, or negotiated rates?
- [ ] Webhooks: push notifications for quote status changes, or polling only?
- [ ] Sandbox: provide a test environment with mock data?

### API surface (builds on existing internal routes)
```
GET    /api/v1/devices              — Search device library
GET    /api/v1/devices/:id/price    — Get price for device at grade
POST   /api/v1/quotes               — Create a single-device quote
POST   /api/v1/bulk-quotes           — Create bulk quote from manifest
GET    /api/v1/quotes/:id            — Get quote status + details
GET    /api/v1/bulk-quotes/:id       — Get bulk quote status + devices
PUT    /api/v1/quotes/:id/accept     — Accept a quote
PUT    /api/v1/bulk-quotes/:id/accept — Accept a bulk quote
```

### Technical scope
- API key generation + validation middleware
- Versioned API routes (`/api/v1/...`) separate from internal routes
- Request logging + usage tracking per partner
- Webhook delivery system (queue + retry)
- API documentation page (auto-generated or manual)
- Admin: API partner management, key rotation, usage dashboard

### Effort estimate
- Medium-large — mostly wrapping existing logic in authenticated, versioned endpoints
- Webhook system is the most complex new piece
- Consider after core flows are stable

---

## Channel 4 — Channel Sales (Partner Portal)

Dedicated partners get their own portal with custom pricing tiers, co-branded landing pages, volume commitments, and reporting. This is the "enterprise" tier — for large repair chains, carriers, or corporate IT departments with recurring volume.

### How it works
1. Partner signs a commercial agreement (volume commitment, custom pricing tier, SLA)
2. Partner gets a branded portal at a subdomain or path (e.g. `tradein.rhex.app/partner/vodafone`)
3. Portal shows partner-specific pricing (may differ from public prices)
4. Partner submits devices in bulk (manifest upload or API), tracks shipments, views reports
5. Monthly invoicing / settlement instead of per-quote payouts

### Key decisions
- [ ] Pricing model: fixed discount off public price, custom price matrix per partner, or negotiated per-deal?
- [ ] Billing: per-device settlement, monthly invoice, or prepaid credit?
- [ ] SLA: turnaround time guarantees for inspection + payment?
- [ ] Multi-user: do partners need team accounts with roles (admin, submitter, viewer)?
- [ ] Reporting: what metrics matter? (volume, revenue, avg grade, turnaround time)

### Technical scope
- `partnerOrgs` Firestore collection (name, tier, pricingModel, customPriceListId, subdomain, branding)
- `partnerUsers` collection or subcollection (email, role, orgId)
- Partner-specific price lists (clone of main price list with custom rates)
- Partner portal pages (`/partner/[code]/dashboard`, `/partner/[code]/estimates`, etc.)
- Co-branded theming (logo, colours pulled from partner config)
- Reporting dashboard with date-range filtering, CSV export
- Admin: partner org management, custom price list assignment, settlement tracking

### Effort estimate
- Large — essentially a mini multi-tenant system
- Only justified with proven partner demand and signed agreements
- Build incrementally: start with custom pricing + dedicated landing page, add portal features over time

---

## Recommended Rollout Order

| Phase | Channel | Reason |
|-------|---------|--------|
| 1 | Referral Program | Lowest effort, validates partner demand, earns commission data |
| 2 | White-Label Widget | Natural extension — partners who want more integration than a link |
| 3 | API Access | For technical partners; builds on existing API routes |
| 4 | Channel Sales Portal | Enterprise tier; only when volume justifies the investment |

---

## Shared Infrastructure (Build Once)

These components are needed across multiple channels and should be built first:

- **Partner registration + management** — Firestore collection, admin CRUD page
- **Attribution tracking** — referral code on quotes/bulkQuotes, cookie-based tracking
- **Partner dashboard shell** — login, earnings summary, referred quotes list
- **Commission engine** — calculate, accrue, and track partner earnings
- **Admin partner overview** — list partners, view activity, manage payouts

---

## Open Questions

1. ~~Are there existing partner relationships to pilot with, or is this greenfield?~~ **Resolved: Greenfield — no existing partners.**
2. ~~What's the target commission range that keeps margins healthy?~~ **Resolved: Default 5% (Mode A), admin-adjustable per partner.**
3. ~~Should partners be able to see Reflow Hub's buy prices, or only the customer-facing sell prices?~~ **Resolved: Partners see their partner rates only (not downstream resale prices, not public consumer payouts).**
4. Is there a legal/compliance requirement for partner agreements (e.g. ITAD certifications)?
5. ~~Do partners need to handle any physical logistics (receiving devices before forwarding)?~~ **Resolved: Mode B partners physically handle devices and ship to Reflow Hub. Mode A partners never touch devices.**
