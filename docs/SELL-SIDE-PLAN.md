# Sell-Side Architecture Plan

## Overview

Extend MARCO from a buy-only trade-in platform into a full buy-and-sell system by adding inventory management, a public storefront, Stripe Checkout, and order fulfillment — all within the existing Next.js app.

---

## Device Lifecycle

```
TRADE-IN (existing)          WAREHOUSE (new)              SELL (new)
─────────────────          ─────────────────            ─────────────
Quote accepted    ──►  Receive & inspect   ──►   Listed on storefront
Device shipped         Refurbish / grade          Customer purchases
Status: paid           Assign sell price          Order fulfilled
                       ↓
                  inventory/{id}            ──►   orders/{id}
```

---

## New Firestore Collections

### `inventory/{id}` — Individual units (not device models)

```typescript
{
  // Identity
  deviceRef: string           // → devices/{docId} (existing device library)
  category: string            // "Phone", "Watch", "Tablet"
  serial: string              // IMEI or serial number

  // Sourcing (links back to buy-side)
  sourceType: "trade-in" | "bulk" | "direct-purchase"
  sourceQuoteId?: string      // → quotes/{id} or bulkQuotes/{id}
  acquiredAt: Timestamp
  costNZD: number             // what you paid (the trade-in payout)

  // Condition & grading
  cosmeticGrade: string       // "A" | "B" | "C" etc.
  batteryHealth?: number      // e.g. 87
  notes?: string              // "minor scratch on bezel"

  // Sell pricing
  sellPriceNZD: number
  sellPriceAUD?: number       // pre-computed or at order time

  // Status lifecycle
  status: "received" | "inspecting" | "refurbishing"
        | "listed" | "reserved" | "sold" | "parts_only"

  // Storefront
  listed: boolean             // visible on /shop
  images: string[]            // actual photos of this specific unit (not generic model shots)
                              // e.g. ["front.jpg", "back.jpg", "scratch-detail.jpg"]
                              // stored in Firebase Storage: inventory/{id}/images/*
  spinVideo?: string          // 360° turntable video URL (short looping MP4)
                              // stored in Firebase Storage: inventory/{id}/spin.mp4

  // Tracking
  location?: string           // "Warehouse A", "Shelf 3B"
  updatedAt: Timestamp
  createdAt: Timestamp
}
```

### `orders/{id}` — Customer purchases

```typescript
{
  // Customer
  customerName: string
  customerEmail: string
  customerPhone?: string
  shippingAddress: {
    line1: string
    line2?: string
    city: string
    region: string
    postcode: string
    country: "NZ" | "AU"
  }

  // Line items
  items: [{
    inventoryId: string       // → inventory/{id}
    deviceRef: string         // → devices/{id} for display
    description: string       // "iPhone 15 Pro 256GB - Grade A"
    priceNZD: number
  }]

  // Totals
  subtotalNZD: number
  shippingNZD: number
  totalNZD: number
  displayCurrency: "NZD" | "AUD"
  totalDisplay: number
  fxRate?: number

  // Payment
  stripePaymentIntentId: string
  stripeCheckoutSessionId?: string
  paymentStatus: "pending" | "paid" | "refunded"

  // Fulfillment
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled"
  trackingNumber?: string
  trackingCarrier?: string    // "NZ Post", "AusPost", "CourierPost"
  shippedAt?: Timestamp
  deliveredAt?: Timestamp

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Navigation & Access Strategy

The app is trade-in dominant. The shop must be present but never compete with the core trade-in flow.

### Structure

- **Route-based separation:** `/shop` is a self-contained section within the same app (one codebase, one deployment)
- **Homepage `/` stays 100% trade-in** — no shop content on the landing page
- **`/shop` gets its own layout** with the Rams aesthetic, category filters, product grid

### Header navigation

```
[Logo]    Trade In (primary CTA button)    Business    |    Shop (text link, secondary)
```

- "Trade In" stays the dominant CTA — button style, left-positioned
- "Shop" is a quiet text link, right-aligned, normal weight — present but not competing
- Same shared header/footer keeps brand coherence

### Cross-sell touchpoints

Rather than pushing the shop in navigation, introduce it at natural moments in the trade-in journey:

- **Quote confirmation page:** "Looking for a replacement? Browse certified devices"
- **Quote accepted email:** Footer link to shop
- **Post-payout email:** "Your payout is complete — upgrade to a [device] from $X"

### Mental model

The user thinks: "I sell my old device here, and I can buy a replacement here too." One brand, two clear actions, each with its own space.

---

## New Routes

### Public Storefront Pages

```
/shop                         → Browse listed inventory (filterable by category, make, model)
/shop/[inventoryId]           → Product detail (photos, grade, battery, price)
/shop/cart                    → Cart (stored in localStorage/cookie)
/shop/checkout                → Stripe Checkout redirect
/shop/order/[id]              → Order confirmation + tracking
```

### Public API

```
GET  /api/shop/products            → Listed inventory (paginated, filterable)
GET  /api/shop/products/[id]       → Single product detail
POST /api/shop/checkout            → Create Stripe Checkout Session → returns URL
GET  /api/shop/orders/[id]         → Order status (by ID + email verification)
POST /api/shop/webhook             → Stripe webhook (payment_intent.succeeded → mark paid, reserve inventory)
```

### Admin Pages & API

```
/admin/inventory                   → Inventory list (filter by status, category, source)
/admin/inventory/[id]              → Detail: edit grade, price, photos, status
/admin/inventory/receive           → Intake form (link to quote, scan IMEI, set cost)
/admin/orders                      → Order list (filter by status)
/admin/orders/[id]                 → Detail: mark shipped, add tracking, refund

GET    /api/admin/inventory            → List inventory
POST   /api/admin/inventory            → Create inventory item (receive device)
GET    /api/admin/inventory/[id]       → Get detail
PATCH  /api/admin/inventory/[id]       → Update (grade, price, status, listing)
POST   /api/admin/inventory/receive    → Receive from quote (auto-fills from quote data)

GET    /api/admin/orders               → List orders
GET    /api/admin/orders/[id]          → Get order detail
PATCH  /api/admin/orders/[id]          → Update status, add tracking
POST   /api/admin/orders/[id]/refund   → Process refund via Stripe
```

---

## Payment Flow (Stripe Checkout)

```
Customer clicks "Buy Now"
  → POST /api/shop/checkout (inventoryIds[])
  → Server creates Stripe Checkout Session
  → Server marks inventory items as "reserved"
  → Redirect to Stripe hosted checkout
  → Stripe webhook fires on success
  → Server creates order, marks inventory "sold", sends confirmation email
  → Customer sees /shop/order/[id] confirmation
```

Stripe Checkout is the fastest path — no need to build a payment form, PCI scope stays minimal, and you get Apple Pay / Google Pay for free.

---

## Reuse from Existing Codebase

| Existing | Reused for |
|----------|-----------|
| `devices/` collection | Product catalog (make/model/storage reference data) |
| `categories` + grades | Storefront filters and grade display |
| `lib/fx.ts` | NZD↔AUD pricing on storefront |
| `lib/categories.ts` | Category tabs on /shop |
| Admin auth (`requireAdmin`) | All /api/admin/inventory and /api/admin/orders routes |
| `customers/` collection | Shared customer records (buyer = seller in some cases) |
| shadcn/ui components | Entire storefront UI |
| Partner system | Future: wholesale channel via partner Mode C |

---

## Build Phases

### Phase 1 — Inventory + Admin ✓ Complete

Receive devices, track status, set sell prices. No public storefront yet — just the internal system. This is valuable on its own for warehouse ops.

**Implemented:**

- `inventory/` Firestore collection with auto-incrementing `inventoryId` via `counters/inventory` transaction
- `GET /api/admin/inventory?status=&category=&search=` — list with filters, batch device lookup for joins
- `POST /api/admin/inventory` — create item with duplicate serial check
- `GET /api/admin/inventory/[id]` — detail with joined device + source quote
- `PATCH /api/admin/inventory/[id]` — update grade, price, status, listing toggle, battery, location, notes
- `POST /api/admin/inventory/receive` — receive from individual or bulk quote (auto-fills device, cost, grade)
- `/admin/inventory` — list page with category tabs, status pill filters, debounced search, pagination (25/page)
- `/admin/inventory/[id]` — detail page with device info, financials (margin calc), source card, condition card, edit dialog
- `/admin/inventory/receive` — progressive disclosure: find quote → summary → intake form
- Admin sidebar nav link (Box icon, after Bulk Quotes)

**Not yet implemented (deferred to Phase 2+):**

- Image upload UI (placeholder card shown on detail page)
- 360° spin video capture/upload

### Phase 2 — Storefront + Checkout ✓ Complete

Public `/shop` pages with Dieter Rams aesthetic, Stripe Checkout (stubbed), order creation. Customers can browse listed inventory and buy.

**Implemented:**

- `.shop-theme` CSS variables in `globals.css` — warm grey Rams palette scoped to `/shop` via class override
- `lib/cart-context.tsx` — React Context + localStorage cart (unique physical units, no quantity)
- `GET /api/shop/products` — public product listing (listed inventory, paginated, filterable by category/make/grade)
- `GET /api/shop/products/[id]` — public product detail (404 if not listed)
- `POST /api/shop/checkout` — creates order + reserves inventory via Firestore transaction; stub mode marks paid immediately, Stripe mode creates Checkout Session when `STRIPE_SECRET_KEY` is set
- `POST /api/shop/webhook` — Stripe webhook handler (returns 501 when not configured)
- `GET /api/shop/orders/[id]` — public order lookup with email verification
- `/shop` layout with Inter font, Rams header/footer, cart icon with count badge
- `/shop` — product grid (3-col desktop, 2-col tablet, 1-col mobile) with category tabs, pagination (24/page)
- `/shop/[id]` — two-column detail: image/video area + grade, battery health bar, price, Add to Cart
- `/shop/cart` — cart with item availability validation on load, summary, checkout button
- `/shop/checkout` — customer + shipping form with order summary sidebar
- `/shop/order/[id]` — order confirmation with items, address, totals
- "Shop" link added to homepage header nav
- `orders/` Firestore collection with auto-incrementing `orderNumber` via `counters/orders` (starts at 1001)
- `stripe` package installed, Firebase Storage image domain in `next.config.ts`

**Not yet implemented (deferred to Phase 3+):**

- Image upload UI (product images show placeholder)
- Real Stripe Checkout (add `STRIPE_SECRET_KEY` to .env to activate)
- Reserved-but-unpaid item release (checkout.session.expired webhook + TTL cron)

### Phase 3 — Order Management + Fulfillment ✓ Complete

Admin order management with status workflow and manual tracking entry.

**Implemented:**

- `GET /api/admin/orders?status=&search=` — list orders with status filter + search (order #, name, email)
- `GET /api/admin/orders/[id]` — full order detail with all fields, null-defaults for tracking fields
- `PATCH /api/admin/orders/[id]` — status transitions with validation (`paid → processing → shipped → delivered`), cancellation with batch write to re-list inventory items
- Status transition validation: `VALID_TRANSITIONS` map enforces allowed state changes, rejects updates on `pending` orders
- Shipping: `processing → shipped` requires `trackingNumber` + `trackingCarrier` (NZ Post, CourierPost, AusPost, Other)
- Cancellation: batch write atomically sets order to `cancelled` and re-lists all inventory items (`status: "listed"`, `listed: true`)
- `/admin/orders` — order list page with status pill filters (paid, processing, shipped, delivered, cancelled), 300ms debounced search, paginated table (25/page), row click to detail
- `/admin/orders/[id]` — two-column detail page: customer info (mailto link), items (linked to `/admin/inventory/[id]`), shipping address, order summary (subtotal/shipping/total, payment status, Stripe IDs), fulfillment card with contextual actions per status
- Fulfillment card: "Mark as Processing" → tracking number input + carrier select + "Mark as Shipped" → "Mark as Delivered"
- Cancel confirmation dialog prevents accidental cancellation
- Admin sidebar "Orders" link with ShoppingCart icon (after Inventory)

**Not yet implemented (deferred):**

- Email notifications (order confirmation, shipped with tracking, delivered)
- Shipping label integration (EasyPost, Shippo, or carrier API)
- Refund endpoint (`POST /api/admin/orders/[id]/refund`) — deferred until Stripe goes live

### Phase 4 — Margin & Analytics

Cost-vs-sell reporting, inventory aging, category performance, turn rates.

- Margin dashboard: `costNZD` vs `sellPriceNZD` per unit and aggregate
- Inventory aging: days from `acquiredAt` to `sold`
- Category performance: units sold, avg margin, turn rate
- Source analysis: trade-in vs bulk vs direct purchase profitability

---

## Design Aesthetic

Inspired by Dieter Rams and Braun — functional, restrained, quietly confident.

### Principles

- **Less, but better.** Every element earns its place. No decorative flourishes, no gratuitous gradients, no visual noise.
- **Content is the interface.** The device is the hero — photography, specs, and grade take center stage. The UI recedes.
- **Honest materials.** Surfaces look like what they are. No faux depth, no skeuomorphism. Flat, matte, tactile.

### Palette

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#F5F3F0` | Page background — warm off-white, like brushed paper |
| `surface` | `#EDEAE6` | Cards, panels — soft warm grey |
| `surface-elevated` | `#FFFFFF` | Modals, popovers — clean white lift |
| `border` | `#D9D5CF` | Subtle dividers — visible but quiet |
| `text-primary` | `#1A1A1A` | Headings, prices — near-black |
| `text-secondary` | `#6B6560` | Descriptions, metadata — warm mid-grey |
| `text-tertiary` | `#9C9690` | Hints, placeholders — light warm grey |
| `accent` | `#2C2C2C` | CTAs, selected states — charcoal (not blue) |
| `accent-hover` | `#404040` | Button hover — slightly lifted charcoal |
| `success` | `#3D7A4A` | In stock, confirmed — muted forest green |
| `caution` | `#B8860B` | Low stock, reserved — dark goldenrod |
| `error` | `#A63D2F` | Out of stock, failed — muted brick red |

### Typography

- **Font stack:** Helvetica Now (preferred), Univers, Akzidenz-Grotesk — the neo-grotesque lineage Rams used at Braun. Clean, neutral, no personality competing with the product. Fallback: `"Helvetica Neue", Helvetica, Arial, sans-serif`.
- **Web option:** If licensing Helvetica Now isn't viable, use [Inter](https://rsms.me/inter/) — it's the closest free equivalent with proper tabular numerals and optical sizing.
- **Headings:** Medium weight (500), generous letter-spacing (+0.01em), uppercase sparingly and only for labels/categories — never for product names.
- **Body:** Regular weight (400), 16px base, 1.5 line-height. Let the text breathe.
- **Prices:** Tabular numerals (`font-variant-numeric: tabular-nums`), medium weight, slightly larger than body (18-20px). Prices should align in columns.
- **No bold abuse** — weight contrast is used sparingly; size and spacing do the work. Maximum two weights on any given page (400 + 500).

### Component Language

- **Cards:** No shadows. 1px `border` on `surface` background. Generous padding (24px). Rounded corners kept small (8px) — not bubbly.
- **Buttons:** Primary CTA is `accent` background with white text, no border-radius excess (6px). Secondary is ghost — `border` outline only. No gradients.
- **Product grid:** Clean 3- or 4-column grid. Device image top, minimal text below (model, grade, price). Whitespace between cards is the visual rhythm.
- **Product detail:** Large device image left, specs and purchase right. Grade displayed as a simple pill (`surface` background, `text-primary`). Battery health as a minimal horizontal bar.
- **Filters:** Horizontal pill toggles for category, dropdown selects for make/model. No sidebar filter panel — keep it linear and simple.
- **Status indicators:** Small coloured dot + text label. No badges, no icons.
- **Transitions:** Subtle opacity and transform transitions (150ms ease). No bounce, no overshoot.

### Photography & 360° Spin

Every listing uses **actual media of that specific unit** — never generic model shots. This is a key trust signal for refurbished devices. Buyers see exactly what they're getting.

#### Still photography

- **Standard shot set per unit:** front, back, and any blemish detail shots
- Neutral light grey background (match `surface`) — a simple photo station with consistent lighting
- Consistent angle and framing across all devices for grid uniformity
- Blemish/wear shots are encouraged, not hidden — honesty builds trust and reduces returns
- No lifestyle imagery on product pages — just the device

#### 360° turntable spin

- **Setup:** motorised turntable, fixed camera, consistent lighting — one take per device
- **Output:** short looping MP4 (3-5 seconds, one full rotation), compressed for web (~1-2MB)
- **Product detail page:** spin video is the hero media — auto-plays muted on load, loops seamlessly. Stills accessible via thumbnail strip below.
- **Product grid:** static front shot as thumbnail (not the video — keep the grid fast and clean). On hover, optionally play a low-res preview of the spin.
- **Fallback:** if a unit doesn't have a spin video (e.g. too small for turntable, watch bands), stills-only is fine — the layout adapts gracefully.

#### Implementation

- **Format:** MP4 with H.264 — universal browser support, hardware-decoded, small file size. No GIF (too large, no compression). Optionally serve WebM for Chrome/Firefox for even smaller files.
- **Playback:** HTML5 `<video autoplay muted loop playsinline>` — no JS player library needed. Lazy-load with `loading="lazy"` or Intersection Observer so off-screen videos don't load.
- **Storage:** Firebase Storage under `inventory/{id}/spin.mp4`, URL stored in `spinVideo` field on the inventory doc. Stills remain in `inventory/{id}/images/*`.
- **Intake workflow:** turntable capture happens during the inspect/refurbish step (Phase 1), alongside still photos, before the item is listed (Phase 2)

### Reference mood

Think Braun ET66 calculator, Vitsoe 606 shelving, Apple Store product pages circa 2014. The confidence to leave space empty. The restraint to use one colour where others would use five.

---

## Key Architectural Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Payment | Stripe Checkout (hosted) | Minimal PCI scope, Apple/Google Pay, fast to ship |
| Cart | localStorage + cookie | No auth required for browsing/carting, simple |
| Inventory model | One doc per physical unit | Enables serial tracking, individual grading, unit economics |
| Sell pricing | Manual per-unit | Refurbished devices vary; no formula-based pricing |
| Images | Firebase Storage, actual unit photos | Real photos of each device — trust signal, reduces returns |
| Inventory ↔ Quote link | `sourceQuoteId` field | Full traceability from acquisition to sale |
| Currency | Reuse existing `lib/fx.ts` | Consistent NZD/AUD handling across buy and sell |
