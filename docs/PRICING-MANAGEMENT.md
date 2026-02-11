# Pricing & Device Management — Planning

## Current State

### Device Management (`/admin/devices`)

- Add/edit/delete individual devices (make, model, storage)
- Bulk CSV import via `/admin/devices/import`
- **No uniqueness check** — duplicate make/model/storage combinations can be created
- Auto-incremented numeric `deviceId` via Firestore counter transaction

### Pricing (`/admin/pricing`)

- CSV upload creates a new price list with 5 grade prices (A-E) per device
- Active price list is **hardcoded to `priceLists/FP-2B`** — all quote APIs read from this
- No inline editing of individual prices
- No way to "activate" a newly uploaded price list — it creates a new doc with a random ID
- 584 devices currently priced

### Gaps

1. No device uniqueness enforcement (make + model + storage)
2. No way to update individual prices without re-uploading entire CSV
3. No cascading/bulk price adjustments across model families
4. No way to disable a device from trade-in without deleting it
5. New price list uploads don't automatically become the active list

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

### `settings/categories` — New document

Defines available product categories and their grade structures. Added early so all pricing features build against a flexible grade system from the start.

```text
categories:
  Phone:
    grades:
      - { key: "A", label: "Excellent" }
      - { key: "B", label: "Good" }
      - { key: "C", label: "Fair" }
      - { key: "D", label: "Screen Issues" }
      - { key: "E", label: "No Power" }
  Watch:                        # future — added when category launches
    grades:
      - { key: "A", label: "Excellent" }
      - { key: "B", label: "Good" }
```

### `settings/pricing` — New document

```text
gradeRatios:
  B: 70                  # percentage of Grade A
  C: 40
  D: 20
  E: 10
rounding: 5              # round to nearest $5 (or 10)
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

### Phase 0: Category Foundation

Lay the data model groundwork before building pricing features, so they're category-aware from the start and don't require rework later.

0a. **Add `category` field to devices** — default all existing devices to `"Phone"`. Add to device creation (single + CSV import). Small data change, no UI impact yet.

0b. **Create `settings/categories` document** — define Phone grade structure (A-E with labels). This becomes the source of truth for which grades exist per category.

0c. **Migrate price storage to `grades` map** — new price writes use `{ grades: { A: 750, B: 525, ... } }` instead of `{ gradeA: 750, ... }`. Read path supports both formats during transition. Pricing page renders columns dynamically from category grade definitions.

### Phase 1: Core Pricing Features

Built for phones but category-aware by design.

1. **Device uniqueness check** — small, immediate quality-of-life fix
2. **Device active toggle** — `active` field + toggle UI + quote API guard
3. **Export CSV** — download current price list and device library as CSV (backup before changes + general utility)
4. **Inline price editing** — click-to-edit cells + PATCH API + add device from pricing page. Grade columns rendered from category definition.
5. **Change preview** — unsaved changes markers, discard/save all, grade inversion warnings
6. **Bulk price adjustment** — select rows + adjust dialog + bulk API
7. **Pricing settings** — admin-configurable grade ratios + rounding in `settings/pricing`

### Phase 2: Multi-Category Expansion

Add new categories incrementally once Phase 1 is stable.

1. **Category management UI** — admin can add/edit categories and define their grade sets
2. **Separate pricing pages per category** — category tabs/selector, each with its own price list
3. **Separate device library pages per category** — `/admin/devices/phones`, `/admin/devices/watches`, etc.
4. **Per-category pricing settings** — ratios and rounding scoped to each category's grade set
5. **Consumer-facing category support** — browsing and quoting filtered by category

### Future Considerations

- **Model family grouping on pricing page** — currently the pricing page is a flat list where the admin searches and manually selects rows for bulk adjust. Grouping would reduce friction for routine price updates across storage variants. Two approaches:
  - **Auto-derived (no data change)**: group rows by existing `make + model` fields at render time. Collapsible sections with "select all" per family. Simple, no backfill needed, but grouping logic is purely UI-based
  - **Explicit `modelFamily` field**: add a `modelFamily` field to each device (e.g., "iPhone 15 Pro"). More flexible — allows custom grouping that doesn't match the model name exactly. Requires backfilling 584 existing devices (could be auto-derived from `model` field initially, then manually adjusted)
- **Product categories** — additional device categories planned beyond phones: Smart Watches, Tablets, Gaming Consoles
  - `category` field on devices (e.g., "Phone", "Tablet", "Watch", "Console")
  - **Separate price list pages per category** — each category gets its own price list (e.g., `priceLists/FP-2B-phones`, `priceLists/FP-2B-watches`). Admin pricing nav shows category tabs or a category selector, each leading to its own pricing page with full inline editing, bulk adjust, etc.
  - **Per-category grade classifications** — each category defines its own set of grades (labels, count, and descriptions). E.g., phones use 5 grades (A-E: Excellent, Good, Fair, Screen Issues, No Power) while watches might only use 2 grades (Excellent, Good). The grading questionnaire, price list columns, and quote APIs would all adapt to the category's grade set
  - Pricing settings (ratios, rounding) per-category — ratios only apply to grades that exist for that category
  - **Separate device library pages per category** — each category gets its own device management page (e.g., `/admin/devices/phones`, `/admin/devices/watches`). Same CRUD, search, toggle, and import functionality but scoped to that category
  - Consumer-facing pages would filter by category for browsing/quoting
