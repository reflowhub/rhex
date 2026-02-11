# Pricing & Device Management — Planning

## Current State

### Device Management (`/admin/devices`)

- Add/edit/delete individual devices (make, model, storage, category)
- Bulk CSV import via `/admin/devices/import` (category-aware)
- Uniqueness check on make + model + storage (enforced on create, edit, and import)
- Auto-incremented numeric `deviceId` via Firestore counter transaction
- Per-device active toggle — inactive devices hidden from trade-in quotes
- Category tabs filter devices by Phone, Watch, Tablet
- CSV export (per category)

### Pricing (`/admin/pricing`)

- Category tabs — each category has its own active price list stored in `settings/categories`
- CSV upload creates/overwrites the active price list for a category
- Inline click-to-edit on individual price cells
- Bulk adjust: adjust by %, adjust by $, set grade ratios from Grade A
- Change preview with unsaved changes banner, yellow highlight, grade inversion warnings
- Grade columns rendered dynamically from category definition (e.g., Watch shows A/B only)
- Add Device dialog from pricing page (creates device + $0 price entry)
- CSV export

### Categories (`/admin/settings`)

- Three categories: Phone (A-E), Watch (A/B), Tablet (A-E)
- Per-category pricing settings (grade ratios + rounding)
- `settings/categories` document stores grade definitions + `activePriceList` per category
- `settings/pricing` document stores per-category grade ratios and rounding

---

## Decisions

| Decision | Outcome |
| --- | --- |
| Cascading approach | Hybrid — flat prices + bulk operations (no formula engine) |
| Grade ratios | B=70%, C=40%, D=20%, E=10% — admin-configurable defaults |
| Rounding | Nearest $5 (configurable to $10) |
| Storage offsets | Manual per-variant — not always uniform |
| Terminal value / floor | **Removed** — not needed |
| Toggle granularity | **Per-device** — all grades on/off together |
| Active price list | **Edit FP-2B directly** — no draft/activate mechanism |
| CSV upload behavior | Overwrites FP-2B directly. Export CSV for backup before changes |
| Ratios/offsets config | Admin-configurable via `settings/pricing` in Firestore |
| Change preview | Yes — visual markers for unsaved changes before committing |

---

## Requirements

### 1. Cascading Price Changes

Ability to adjust prices across a model family (e.g., "all iPhone 14 variants") or by storage tier, without editing 584 individual cells.

**Approach: Hybrid (flat prices + bulk operations)**

- Prices remain the source of truth as flat values (like now)
- Bulk operations write new values directly — no formula engine
- After bulk adjust, individual prices can still be hand-tweaked
- All computed prices **round to nearest $5** (configurable to $10)
- Default grade ratios and rounding stored in `settings/pricing` — admin-editable

**Operations:**

#### a) Adjust by % (+/- all grades)

Select devices -> apply percentage change across all grades.
E.g., select all iPhone 14 -> adjust -10%.

#### b) Adjust by $ (+/- per grade or all grades)

Select devices -> apply flat dollar change.
E.g., select all 64GB variants -> adjust -$30 across all grades.

#### c) Set grade ratios from Grade A

Set Grade A price, then derive B-E using configurable default ratios:

| Grade | Default Ratio | Example (A = $750) |
| --- | --- | --- |
| **A** | 100% | $750 |
| **B** | 70% | $525 |
| **C** | 40% | $300 |
| **D** | 20% | $150 |
| **E** | 10% | $75 |

Defaults stored in `settings/pricing` and pre-filled in the bulk adjust dialog. Admin can override per operation. Results round to nearest $5.

#### d) Storage offsets within a model family

Storage tiers within a model are managed manually — offsets are not always uniform.
E.g., iPhone 15 Pro: 128GB = $750, 256GB = $750, 512GB = $800, 1TB = $800.
The admin sets Grade A per storage variant, then applies grade ratios to derive B-E.

**Typical workflow:**

1. Filter to a model family (e.g., "iPhone 15 Pro")
2. Set/adjust Grade A prices per storage variant
3. Apply grade ratios (B=70%, C=40%, D=20%, E=10%) -> writes all grades
4. Hand-tweak any individual cells that need rounding or special treatment

### 2. Granular Price Adjustment

Inline editing of individual device/grade prices directly in the price list view.

- Click a cell -> edit in place -> save
- Single-device price update API: `PATCH /api/admin/pricing/[listId]/prices/[deviceDocId]`
- **Add Device from pricing page**: "Add Device" button creates a new device (with uniqueness check) + empty price row ($0 across all grades). New devices default to `active: false` (toggled off) — admin sets prices then explicitly toggles on when ready
- Audit trail: who changed what, when (stretch goal)

### 3. Change Preview (Unsaved Changes)

Before committing bulk or inline edits, show visual markers so the admin can review changes.

- **Changed cells**: highlighted background (e.g., light yellow)
- **Old -> new value**: shown inline (e.g., `$750 -> $680`)
- **Change count**: badge showing "12 unsaved changes"
- **Actions**: [Discard All] [Save All] button pair
- Changes are held in client state until explicitly saved
- Bulk adjust opens a preview dialog showing all affected rows before applying
- **Grade inversion warning**: if a lower grade has a higher price than the grade above it (e.g., Grade C > Grade B), highlight the cell in red/orange with a tooltip explaining the issue (e.g., "Grade C ($150) is higher than Grade B ($120)"). Shown in real-time during editing. Warning only, not a hard block — allows saving but makes the anomaly visible

### 4. Toggle Device On/Off

Disable specific devices from being eligible for trade-in without deleting them or their prices.

- **Per-device toggle** — all grades on/off together
- Add `active: boolean` field to device document (default `true`)
- Quote APIs check `active` flag — if `false`, return "not eligible for trade-in"
- Admin UI: toggle switch on device library + visual indicator on pricing page
- Disabled devices stay in the price list (prices preserved) but don't generate quotes

### 5. Device Uniqueness

Prevent duplicate make + model + storage combinations.

- On create/edit: query devices where `make`, `model`, `storage` match (case-insensitive)
- If duplicate found, return error with link to existing device
- Apply to both single-device creation and CSV import

---

## Proposed UI Changes

### `/admin/pricing/[id]` — Enhanced Price List View

```text
+-------------------------------------------------------------+
| FP-2B                                                       |
| Effective: 13 Jan 2026  NZD  584 devices                    |
|                                                             |
| [Search...]  [Bulk Adjust v]  [Export CSV]                  |
|                                                             |
|              ** 4 unsaved changes **  [Discard] [Save All]  |
|                                                             |
| []  ID    Make    Model           Storage  A     B     C    |
| []  374   Apple   iPhone 11       128GB    $250  $180  $100 |
| [x] 8     Apple   iPhone 11       256GB   *$280 *$200  $120 |
| []  993   Apple   iPhone 11       64GB     $250  $180  $100 |
| [x] 992   Apple   iPhone 11 Pro   256GB   *$230 *$160  $100 |
|                                                             |
| * = changed (highlighted yellow, shows old -> new on hover) |
|                                                             |
| Select rows -> [Adjust Selected v]                          |
|   - Adjust by % (+/- all grades)                            |
|   - Adjust by $ (+/- per grade)                             |
|   - Set grade ratios from Grade A                           |
|                                                             |
| Click any price cell to edit inline                         |
+-------------------------------------------------------------+
```

### `/admin/devices` — Device Library with Toggle

```text
+-------------------------------------------------------------+
| Device Library                                              |
|                                                             |
| [Search...]                    [Import]  [Add Device]       |
|                                                             |
| ID    Make    Model           Storage  Active   Actions     |
| 374   Apple   iPhone 11       128GB    [on]     edit  del   |
| 8     Apple   iPhone 11       256GB    [on]     edit  del   |
| 993   Apple   iPhone 11       64GB     [off]    edit  del   |
+-------------------------------------------------------------+
```

### `/admin/settings` — Pricing Defaults

```text
+-------------------------------------------------------------+
| Pricing Settings                                            |
|                                                             |
| Default Grade Ratios (applied when using "Set from Grade A")|
|   Grade B:  [70] %                                          |
|   Grade C:  [40] %                                          |
|   Grade D:  [20] %                                          |
|   Grade E:  [10] %                                          |
|                                                             |
| Rounding: [Nearest $5 v]                                    |
|                                                             |
|                                   [Save Settings]           |
+-------------------------------------------------------------+
```

---

## API Changes

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `POST /api/admin/devices` | POST | Add uniqueness check (make + model + storage) |
| `PUT /api/admin/devices/[id]` | PUT | Add uniqueness check on edit |
| `PATCH /api/admin/devices/[id]/toggle` | PATCH | Toggle device active/inactive |
| `PATCH /api/admin/pricing/[listId]/prices/[deviceDocId]` | PATCH | Update individual device grade prices |
| `POST /api/admin/pricing/[listId]/bulk-adjust` | POST | Bulk adjust selected devices by %/$/ratios |
| `GET /api/admin/settings/pricing` | GET | Fetch default grade ratios + rounding |
| `PUT /api/admin/settings/pricing` | PUT | Update default grade ratios + rounding |

---

## Data Model Changes

### `devices/{docId}` — Add fields

```text
active: boolean          # default true, false hides from trade-in
category: string         # "Phone" (default), "Watch", "Tablet", "Console"
```

### `settings/categories` — Category definitions

Defines available product categories, their grade structures, and active price list references.

```text
Phone:
  grades:
    - { key: "A", label: "Excellent" }
    - { key: "B", label: "Good" }
    - { key: "C", label: "Fair" }
    - { key: "D", label: "Screen Issues" }
    - { key: "E", label: "No Power" }
  activePriceList: "FP-2B"
Watch:
  grades:
    - { key: "A", label: "Excellent" }
    - { key: "B", label: "Good" }
  activePriceList: null
Tablet:
  grades:
    - { key: "A", label: "Excellent" }
    - { key: "B", label: "Good" }
    - { key: "C", label: "Fair" }
    - { key: "D", label: "Screen Issues" }
    - { key: "E", label: "No Power" }
  activePriceList: null
```

### `settings/pricing` — Per-category pricing settings

```text
Phone:
  gradeRatios:
    B: 70                  # percentage of Grade A
    C: 40
    D: 20
    E: 10
  rounding: 5              # round to nearest $5 (or 10)
Watch:
  gradeRatios:
    B: 70
  rounding: 5
Tablet:
  gradeRatios:
    B: 70
    C: 40
    D: 20
    E: 10
  rounding: 5
```

### Price list prices — Flexible grade storage

Currently stored as `gradeA`, `gradeB`, etc. To support variable grades per category, prices should be stored as a map:

```text
# Current (hardcoded grades):
{ gradeA: 750, gradeB: 525, gradeC: 300, gradeD: 150, gradeE: 75 }

# Future-proof (dynamic grades):
{ grades: { A: 750, B: 525, C: 300, D: 150, E: 75 } }
```

**Migration note**: existing `gradeA`-`gradeE` fields can be read as-is during a transition period. New writes should use the `grades` map format. The pricing page renders columns dynamically based on the category's grade definition from `settings/categories`.

### Quote APIs — Check active flag

```text
Lookup device -> if !active -> return "Device not eligible for trade-in"
```

---

## Implementation Order

### Phase 0: Category Foundation ✅

Lay the data model groundwork before building pricing features, so they're category-aware from the start and don't require rework later.

0a. ✅ **Add `category` field to devices** — default all existing devices to `"Phone"`. Add to device creation (single + CSV import). Small data change, no UI impact yet.

0b. ✅ **Create `settings/categories` document** — define Phone grade structure (A-E with labels). This becomes the source of truth for which grades exist per category.

0c. ✅ **Migrate price storage to `grades` map** — new price writes use `{ grades: { A: 750, B: 525, ... } }` instead of `{ gradeA: 750, ... }`. Read path supports both formats during transition. Pricing page renders columns dynamically from category grade definitions.

### Phase 1: Core Pricing Features ✅

Built for phones but category-aware by design.

1. ✅ **Device uniqueness check** — `lib/device-uniqueness.ts` shared check. Enforced on create, edit, and CSV import. Returns 409 on duplicate.
2. ✅ **Device active toggle** — `active` field + Switch UI in device library + `PATCH /api/admin/devices/[id]/toggle` + quote API guard (public, partner, and matching APIs all filter inactive devices)
3. ✅ **Export CSV** — `lib/csv-export.ts` shared helpers. Export buttons on both device library and pricing pages. Client-side CSV generation.
4. ✅ **Inline price editing** — click-to-edit cells + `PATCH /api/admin/pricing/[id]/prices/[deviceId]` + Add Device dialog from pricing page (creates device + $0 price entry)
5. ✅ **Change preview** — unsaved changes tracked in client state, yellow highlight for changed cells, orange highlight + warning icon for grade inversions, "N unsaved prices changed" banner with Discard All / Save All
6. ✅ **Bulk price adjustment** — checkbox row selection, Bulk Adjust dialog with 3 operations (adjust by %, adjust by $, set grade ratios from A), `POST /api/admin/pricing/[id]/bulk-adjust` API using settings for rounding + ratios
7. ✅ **Pricing settings** — `settings/pricing` Firestore doc, `lib/pricing-settings.ts` loader + `roundPrice()` helper, `/admin/settings` page with grade ratio inputs + rounding select, sidebar link added

### Phase 2: Multi-Category Expansion ✅

Phone, Watch (2 grades: A, B), and Tablet (5 grades: A-E). Each category has its own grade structure, price list, and pricing settings.

1. ✅ **Category data model** — `lib/categories.ts` with `loadCategories()`, `getActivePriceList()`, `getCategoryGrades()` (60s TTL cache). Each category in `settings/categories` stores grades array + `activePriceList` reference.
2. ✅ **Per-category pricing settings** — `settings/pricing` is category-keyed (`{ Phone: { gradeRatios, rounding }, Watch: {...} }`). `loadPricingSettings(category?)` with backward compat for old format.
3. ✅ **Category management UI** — admin settings page with category cards showing grades as badges + active price list. Per-category pricing settings with dynamic grade ratio inputs.
4. ✅ **Device library category tabs** — category tabs on `/admin/devices`, devices filtered by selected category. Category selector on device create, passed to API.
5. ✅ **Pricing page category tabs** — category tabs on `/admin/pricing`, each with its own active price list. Dynamic grade columns from category definition. CSV upload, inline editing, bulk adjust all category-aware.
6. ✅ **Quote APIs** — all quote endpoints (`/api/quote`, `/api/partner/quote`, `/api/business/estimate`, `/api/partner/estimate`) use `getActivePriceList(category)` instead of hardcoded FP-2B. Grade validation against category's grade set.
7. ✅ **Consumer & partner pages** — category tabs on homepage, business estimate, and partner estimate pages. Device search filtered by category. Dynamic grade selectors from category definition.
8. ✅ **Public categories API** — `GET /api/categories` returns category names + grades (no auth required). Used by consumer pages.

### Future Considerations

- **Model family grouping on pricing page** — currently the pricing page is a flat list where the admin searches and manually selects rows for bulk adjust. Grouping would reduce friction for routine price updates across storage variants. Two approaches:
  - **Auto-derived (no data change)**: group rows by existing `make + model` fields at render time. Collapsible sections with "select all" per family. Simple, no backfill needed, but grouping logic is purely UI-based
  - **Explicit `modelFamily` field**: add a `modelFamily` field to each device (e.g., "iPhone 15 Pro"). More flexible — allows custom grouping that doesn't match the model name exactly. Requires backfilling 584 existing devices (could be auto-derived from `model` field initially, then manually adjusted)
