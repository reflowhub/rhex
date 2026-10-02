# Trade-In Flow & States — Plan

Status: agreed 2026-10-02. Scope: single-device trade-in quotes (`quotes` collection).
Bulk quotes and the Mode A/B partner API are reviewed separately, after this plan.

## 1. Review findings

The plan resolves these findings from the 2026-10-02 review of the trade-in flow.

| # | Severity | Finding |
|---|---|---|
| 1 | High | Public `GET /api/quote/[id]` returns the whole quote, including bank/PayID details, contact details, geo data and partner pricing, to anyone with the ID |
| 2 | High | Public `PUT /api/quote/[id]` (accept + revision response) reads the status and then writes separately, so concurrent requests can both succeed (missed by c5f3a4f); no rate limit; no partner/sandbox check |
| 3 | High | Revised prices are entered in NZD but shown to AUD customers, and emailed to them, as AUD |
| 4 | High | Customer quote page only recognises `accepted`; later states show "Accept Quote" or "expired" |
| 5 | Medium | Revision expiry runs only when the quote is viewed, writes without checking the status, and isn't applied in list views |
| 6 | Medium | Admin PUT isn't transactional; doesn't validate revision fields; fields can be edited at any status; commission dedupe isn't atomic; no audit log |
| 7 | Medium | `paid → cancelled` leaves commission and inventory in place; cancelling while RHEX holds the device is undefined |
| 8 | Medium | Inventory receive allows `received` (before inspection), with the original price as cost |
| 9 | Medium | Customer edits overwrite payment details on paid quotes |
| 10 | Low | No `expired` state; no deadline after acceptance |
| 11 | Low | Revision window: 14 days in code, 7 days in the email fallback and the docs |

Found during planning:

| # | Finding |
|---|---|
| 12 | Quote page shows a placeholder shipping address (`[Address]`, `[City, State, Postcode]`) |
| 13 | No terms consent at acceptance; consent is only claimed afterwards, in the email |
| 14 | Terms §5, the quote page and the code each give a different validity rule |
| 15 | Terms page effective date is `[Insert date]` |
| 16 | Customers have no way back to an unaccepted quote; abandoned quotes inflate the funnel |
| 17 | Customer `totalValueNZD` only ever increases (at acceptance) |
| 18 | Storage rules make every file publicly readable, so they're unsuitable for shipping labels |

## 2. Decisions

| ID | Decision |
|---|---|
| D1 | Public quotes (`/sell` and the embed) are valid for **24 hours** (`quoted → expired`). Partner portal, v1 API and admin-created quotes keep 14 days until the Mode A/B review. |
| D2 | **Post-by deadline:** the customer must lodge the device with RHEX's label within **14 days of the label being sent** (`postByAt`). There is an internal transit allowance of **10 days** (`expectedByAt` = `postByAt` + 10d); later arrivals get a `lateArrival` flag and an admin checks the first-scan date. Lodged late → admin chooses honour or reassess (`lateDecision`). Never received → `accepted → expired` at `postByAt` + 30 days; an admin may still receive an expired quote if it had been accepted. |
| D3 | Revision response window: **7 days**. Held in admin settings, not an env var. No response = rejection → `returning`. |
| D4 | No `paid → cancelled`. |
| D5 | Cancellation is allowed only from `quoted`, `accepted` and `shipped`. Once RHEX holds the device, the quote ends as `returned` (sole exception: `on_hold → cancelled` when the device is surrendered to authorities). |
| D6 | Revised prices are converted at the quote's locked `fxRate`. The customer-currency amount is stored (`revisedPriceDisplay`). |
| D7 | Public endpoints never expose partner pricing. Whether partner quotes should be reachable publicly at all is decided in the Mode A/B review. |
| D8 | Shipping: RHEX creates an Australia Post label in the AusPost portal for each accepted quote and emails it. The customer supplies packaging. `shipped` is optional (set by the customer's "I've posted it", an admin, or later the carrier). `accepted → received` is allowed. |
| D9 | Quotes are one-session only. Expired quotes are kept for funnel analytics. |
| D10 | Terms checkbox required at acceptance; store `termsAcceptedAt` and `termsVersion`. The current terms take effective date **2 October 2026** (`termsVersion: "2026-10-02"`). |
| D11 | New **`on_hold`** state for ownership/blacklist/fraud checks (terms §3). Payment is blocked while on hold. |
| D12 | **Revisions only go down.** If a device is better than declared, RHEX pays the original quote. `revised` requires a revised price below the original. |
| D13 | Label turnaround: copy says "We'll email your prepaid label shortly" (no time promised). The admin "Awaiting label" queue shows how long each quote has waited. |

Unused-label refunds: AusPost allows 90 days to request a refund. Labels enter the refund queue when their quote expires (day 44) or is cancelled before shipping. They are processed weekly after checking tracking shows no scans, and flagged urgent at day 75.

## 3. Target state machine

```
quoted ──► accepted ──► shipped ──► received ──┬──► inspected ──► paid
  │          │  │          │          ▲        │       ▲  │
  ▼          │  └──────────┼──────────┘        ├──► revised ──┘ (accept / admin force)
expired* ◄───┘             │      (direct)     │       │
  │ (accepted only)        │                   │       ▼ (reject / 7-day expiry)
  └──► received            │                   ├──► returning ──► returned
                           │                   │
cancelled ◄────────────────┘                   └──► on_hold* ──► (back to held-from state)
  (from quoted / accepted / shipped;                    │  ──► returning
   on_hold only for surrender to authorities)           └──► cancelled (surrendered)
```
`*` = new state.

### Transition table

`lib/quote-transitions.ts` (pure rules) and `lib/transition-quote.ts` (`transitionQuote`: transaction and side effects) become the only code that changes a quote's status. Actors: `customer` (public link), `partner` (portal), `apiKey` (v1), `admin`, `system` (cron, or the expiry check when a quote is opened).

| From → To | Actors | Guard | Side effects (after commit, only for the call that made the change) |
|---|---|---|---|
| quoted → accepted | customer, apiKey, admin | not expired; required contact + payout details; `termsAccepted` (customer) | assign `TI-` reference; link customer; acceptance email; enters "Awaiting label" queue |
| quoted → expired | system | `expiresAt` passed | none |
| quoted → cancelled | admin | `cancelReason` | none |
| accepted → shipped | customer, admin | label sent (customer only) | stops reminders |
| accepted → received | admin | IMEI/serial entered | set `lateArrival` if past `expectedByAt` |
| accepted → expired | system | label sent; `postByAt` + 30d passed | closing email; label → refund queue |
| accepted → cancelled | admin | `cancelReason` | label → refund queue (if sent) |
| shipped → received | admin | IMEI/serial entered | set `lateArrival` if past `expectedByAt` |
| shipped → cancelled | admin | `cancelReason` (e.g. `lost_in_transit`) | none (scanned labels aren't refundable) |
| expired → received | admin | quote had been accepted; IMEI/serial | `lateArrival: true` |
| received → inspected | admin | `inspectionGrade`; pays original quote (D12) | none |
| received → revised | admin | `inspectionGrade`; `revisedPriceNZD` < `quotePriceNZD` | `revisedPriceDisplay` at locked FX; `revisionExpiresAt` = +7d; revised email |
| received → returning | admin | reason (e.g. rejected device, §14) | none |
| received / inspected → on_hold | admin | reason | store `heldFrom` |
| on_hold → held-from state | admin | release note | none |
| on_hold → returning | admin | reason | none |
| on_hold → cancelled | admin | reason = surrendered to authorities | none |
| revised → inspected | customer, partner, apiKey, admin (force, with reason) | before `revisionExpiresAt` (except admin) | none |
| revised → returning | customer, partner, apiKey, system | system: `revisionExpiresAt` passed (`revisionAutoExpired`) | none |
| inspected → paid | admin | payout details present; not on hold | payout snapshot; commission (idempotent); paid email |
| inspected → returning | admin | reason | none |
| returning → returned | admin | none | reduce customer `totalValueNZD` |

Every transition writes the status, the matching timestamp and a `statusHistory` entry `{from, to, actor, at, reason}`. Admin transitions are also written to `lib/audit-log.ts`. Sandbox quotes skip emails, customer linking and commission (handled once, in the module).

Removed from today's table: `paid → cancelled`, `received/revised/inspected/returning → cancelled`.

**Cancellation reasons.** Every cancellation needs a `cancelReason` code plus an optional note:

| Code | Use |
|---|---|
| `not_genuine` | Bot, scraping, fake or test details |
| `customer_request` | Customer asked to cancel |
| `duplicate` | Customer accepted the same device twice |
| `lost_in_transit` | Shipped but never arrived |
| `surrendered` | `on_hold` only: device handed to authorities |
| `other` | Note required |

Cancellations send no customer email. Analytics and funnel metrics leave out `not_genuine` quotes.

### Timeline after acceptance

| Day (from label sent) | What happens |
|---|---|
| — | Accepted; "We'll email your prepaid label shortly"; appears in the "Awaiting label" queue |
| 0 | Label emailed (PDF attached + link to the quote page). "Use your label by {day 14}." |
| 7 | Reminder (skipped if marked shipped or received) |
| 12 | "Post by {date}" reminder (same conditions) |
| 14 | `postByAt`: last day to lodge |
| 24 | `expectedByAt`: not yet received → shown as overdue to admins |
| 44 | `accepted → expired`; closing email ("label cancelled, don't use it"); label → refund queue |
| 75 | Unrefunded labels flagged urgent |
| 90 | AusPost refund deadline |

## 4. Phases

### Phase 0: hotfixes (ship now; findings 1, 2, 12, 13, 15)

1. **Public GET returns only allowed fields.** `app/api/quote/[id]/route.ts` returns a fixed list of fields. Bank/PayID details are masked (`•••• 123`). Removed: phone, address, geo, user agent, `partnerId`, `publicPriceNZD`, `partnerRateDiscount`. The PUT response uses the same list.
2. **Public PUT made safe.** Accept and revision response go through `updateIfStatus`; side effects run only for the call that made the change. 404 for `partnerMode === "B"` and sandbox quotes. Add `checkRateLimit`.
3. **Terms consent.**
   - Set the terms page effective date to 2 October 2026.
   - Add a `TRADEIN_TERMS_VERSION = "2026-10-02"` constant.
   - Add a required checkbox on the accept form.
   - The public PUT rejects acceptance without `termsAccepted: true` and stores `termsAcceptedAt` and `termsVersion`.
   - v1 accept is unchanged (Mode A/B review).
4. **Shipping copy.**
   - Replace the placeholder address block with "We'll email your prepaid Australia Post label shortly" plus packing guidance (rigid box, padding, remove SIM/accounts; matches terms §6/§8).
   - Replace "valid for 14 days from acceptance" with "Once we send your label, you'll have 14 days to post your device."
   - Update `emails/quote-accepted.tsx` to match.
5. **Ops (manual, not code).** List accepted quotes that saw the placeholder address and send their labels by hand. Until Phase 2 ships, labels are emailed manually from the RHEX mailbox, with the tracking number noted on the quote (admin notes).

### Phase 1: transition module & state model (findings 6, 7; D4, D5, D11, D12)

1. `lib/quote-transitions.ts`: the transition table above and guards, as pure functions (`planTransition`, `allowedTransitions`). `lib/transition-quote.ts`: `transitionQuote(id, to, {actor, payload})` inside a transaction, `statusHistory`, side effects after commit, audit log for admins (`quoteAuditLog`).
2. Shared `QUOTE_STATUSES` and labels in `lib/quote-status.ts`.
3. Move every status write onto the module: public quote PUT, v1 accept/respond, partner respond, admin PUT, `applyRevisionExpiry`. `lib/status-transition.ts` stays for bulk quotes.
4. **Guards:** IMEI/serial required at `received`; `revised` requires grade and a price below the original; inspection and revision fields can only be written during the `received → revised/inspected` step.
5. **New states/transitions:** `on_hold` (with `heldFrom`), `accepted → received`, the D4/D5 removals. `expired` is added to the table here but nothing triggers it until Phase 3.
6. **Sequential `TI-` reference** assigned at acceptance (`counters/tradeIns`, same pattern as `counters/orders`). Backfill script for existing accepted quotes.
7. **Commission:** ledger document ID `quote_{id}`, written with `create()`, so a second call fails instead of duplicating.
8. **Admin quote page:** GET returns `allowedTransitions` for the current admin; buttons, stepper and labels come from it (replacing `getNextStatus` and `getActionLabel`). Add on-hold and admin-return dialogs that require a reason, and a cancel dialog that requires a `cancelReason` code. The inspection dialog applies D12 (a better device → "Confirm at original quote").
9. Add **vitest** with full tests for `lib/quote-transitions.ts` (every allowed and blocked move, every guard, every actor).

### Phase 2: shipping labels & receiving (D8, D13; findings 12, 18)

1. **Storage:** production has no Firebase Storage bucket (checked 2026-10-02), so label PDFs are stored as bytes in private Firestore docs, like product images (`imageBlobs`): one `shippingLabels` doc per label (tracking, cost, `refundState`) with its PDF in `labelBlobs/{labelId}`. The quote holds its current label's fields. `storage.rules` is still narrowed to `inventory/**` for public reads.
2. **Email:** add `attachments` to `lib/email.ts`. New `emails/quote-label.tsx` (label attached, `TI-` reference, use-by date, packing guidance, "View your trade-in" link).
3. **Admin quote page:** upload the label PDF and enter the tracking number. Saves `trackingNumber`, `carrier: "auspost"`, `labelSentAt`, `postByAt`, `expectedByAt` and optional `labelCostAUD`, then sends the label email.
4. **Customer quote page:**
   - "Download label" via `/api/quote/[id]/label` (served through the admin SDK)
   - the post-by date
   - "I've posted it" button, which moves the quote `accepted → shipped`
   - instruction to put the `TI-` reference on a note inside the box
5. **Admin queues:**
   - **Awaiting label:** accepted, no label, oldest first, with age. Multi-select "Cancel as not genuine", for clearing bot acceptances in one go.
   - **Overdue:** past `expectedByAt`
   - **Labels to refund:** labels with `refundState: "pending"` (replaced, or the quote expired / was cancelled before shipping); urgent at day 75; "Mark refunded" or "Was used" (not refundable)
6. **Receive parcel screen:**
   - scan box that works with a barcode scanner; matches on tracking number (contains), `TI-` reference, customer name/email or IMEI
   - shows the expected device and customer
   - IMEI/serial entry with a mismatch warning against the quote
   - receives the quote through the module
   - "Log unmatched parcel" (photo, IMEI, note) → `unmatchedParcels` collection (terms §17)
7. Before building, test-scan one real AusPost label to confirm what the barcode contains, and check whether the portal has a label reference field (for printing the `TI-` reference).

### Phase 3: expiry & reminders (findings 5, 10, 11, 16; D1, D2, D3)

1. **Validity by source:** public/embed `expiresAt` = 24h; partner, v1 and admin quotes stay at 14 days.
2. **Revision window:** move it to admin settings (7 days) and remove `REVISION_EXPIRY_DAYS`. It isn't set in Vercel (checked 2026-10-02), so production currently uses the 14-day code default. The revised email uses the stored `revisionExpiresAt`.
3. **Cron** `/api/cron/quote-expiry` (hourly, `CRON_SECRET`, pages of about 200, every move through the module). It must export **`GET`**, because Vercel Cron sends GET requests; the existing cleanup cron exports only POST and returns 405 on every run.
   - `quoted` past `expiresAt` → `expired`
   - `accepted` with label, past `postByAt` + 30d → `expired` (closing email, refund queue)
   - `revised` past `revisionExpiresAt` → `returning` (`revisionAutoExpired`)
   - day-7 and day-12 reminders (not shipped/received; `remindersSent` field so each sends once)
4. The expiry check when a quote is opened stays as a backstop, also through the module.
5. **Firestore indexes:** `(status, expiresAt)`, `(status, postByAt)`, `(status, revisionExpiresAt)`.
6. **Checkout trade-in linking** (`app/api/buy/checkout/route.ts`) requires `status === "accepted"` (not `expired`) instead of checking `expiresAt`.
7. **Migration** `scripts/migrate-quote-expiry.ts` (dry run by default):
   - `quoted` quotes past `expiresAt` → `expired`
   - accepted quotes without a label stay in "Awaiting label"
   - stale `revised` quotes are left for the cron job

### Phase 4: money & stock (findings 3, 8, 9, 17; D6)

1. Store `revisedPriceDisplay` when a quote is revised, at the locked `fxRate`.
2. Add `payableAmount(quote)` → `{amount, currency}`. Used by the customer page, emails, the admin "Mark Paid" confirmation and inventory cost (NZD).
3. Inspection dialog shows the NZD amount and the customer-currency amount side by side.
4. `paid` saves a `payout` snapshot: method, masked details, amount, currency, `paidAt`, `paidBy`.
5. Customer-record edits stop copying payment details onto quotes in `paid`, `returned`, `cancelled` or `expired`.
6. Inventory receive is allowed only at `inspected` or `paid`, with cost = `payableAmount` in NZD. One-off report of trade-in inventory items whose quote is still `received`.
7. Reduce customer `totalValueNZD` when a quote ends as `returned`, `cancelled` or `expired`.

### Phase 5: UI, consumers, docs (finding 4)

1. **Customer page** `app/sell/quote/[id]/page.tsx`: one view per status (including `expired`, `on_hold` shown as "Under review", `shipped` and the label states). Accept form only for unexpired `quoted`. Timeline built from `statusHistory`.
2. Move everything that compares status strings onto `QUOTE_STATUSES`. Analytics leaves out `cancelReason: "not_genuine"`.
   - admin quotes list (filters for the new states and queues)
   - `app/api/admin/analytics/{funnel,revenue,inventory}`
   - `app/api/partner/{stats,earnings,referral/stats}`
   - `app/partner/quotes/*`, `app/partner/dashboard`, `app/partner/earnings`
3. **`docs/API-REFERENCE.md`:**
   - status table (`expired`, `on_hold`)
   - 7-day revision window
   - removed transitions
   - "new status values may be added" note
4. **Terms page:** publish the legally reviewed §5/§6/§13 (Appendix A) with a new effective date, and bump `TRADEIN_TERMS_VERSION` to match.

### Order

| Phase | Depends on | Notes |
|---|---|---|
| 0 | — | Ship now |
| 1 | 0 | Largest refactor |
| 2 | 1 | Unblocks the label-based deadlines |
| 3 | 1, 2 | Accepted-quote expiry needs `labelSentAt` |
| 4 | 1 | Can run in parallel with 2–3 |
| 5 | 2–4 | Terms change waits for legal sign-off |

## 5. Verification

**Preview deployments use production services** (checked 2026-10-02). The Firebase, Resend and Stripe secret-key variables each have a single entry shared by Development, Preview and Production. GA, Clarity and Google Ads IDs are set for Preview too. So testing on a preview:
- writes real Firestore data
- sends real emails
- fires analytics and ad conversion events

`CRON_SECRET` is production-only, and Vercel crons only run on production. Until Preview gets its own Firebase project (e.g. rhw-dev) and its own Resend key, test with sandbox data and your own email address, and accept that test acceptances record ad conversions.

- **vitest:** the transition table and guards (Phase 1).
- **Concurrency script** against dev Firestore: the same transition called twice at once → exactly one succeeds, one email, one commission entry.
- **Cron:** run against dev data with time moved forward; rerun the migration in dry-run mode → no-op.
- **Manual walkthrough on dev** as customer, partner portal, v1 API key and admin through each path:
  - happy path
  - revision accepted, rejected and expired
  - late arrival (honour and reassess)
  - on hold
  - expired-then-received
  - label refund
- `npm run build`.

## 6. For the Mode A/B review

- Partner and v1 quote validity (currently 14 days) and whether the 24h rule applies.
- Terms consent for v1 accepts (partners accepting for customers).
- Who ships for partner quotes; whether partners get RHEX labels; v1 endpoints for label, tracking and "posted".
- Mode B revision emails (currently sent to `customerEmail` with a partner-portal link).
- Whether revised Mode B prices are entered at the public rate or the partner rate (`publicPriceNZD` is not returned by the admin endpoint).
- Whether partner quotes should be reachable on the public endpoints at all (D7).
- New status values (`expired`, `on_hold`) are a contract change for v1 consumers.

## 7. Backlog (not planned)

- "Email me this quote" (save the quote and get a link), with a reminder before it expires.
- Automatic labels and first-scan "shipped" through the AusPost API (depends on account type).
- Firestore TTL policy to delete expired quotes after about 12 months.

## Appendix A: Draft terms changes (for legal review)

> **5. Quote validity**
>
> An Indicative Quote is valid for **24 hours** from the time it is issued. To proceed, you must submit a Trade-In Order within that period.
>
> After you submit a Trade-In Order, we will email you a shipping label. You must lodge your Device with the carrier using that label within **14 days of the date we send it to you** (the **Lodgement Period**). If you lodge your Device within the Lodgement Period, we will assess it against your Indicative Quote, subject to these Terms.
>
> If your Device is lodged after the Lodgement Period, we may, at our discretion:
> (a) honour the Indicative Quote; or
> (b) reassess your Device at our then-current pricing and provide a Final Offer.
>
> If your Device has not been lodged within 30 days after the end of the Lodgement Period, we may cancel your Trade-In Order and the shipping label we provided. If your Device is received after your Trade-In Order has been cancelled, we will contact you and may, at our discretion, process it under paragraph (b) above or return it to you in accordance with these Terms.
>
> You may reject any Final Offer that differs from the Indicative Quote and request return of the Device in accordance with these Terms.

> **6. Shipping your Device** *(add after the first paragraph)*
>
> A shipping label provided by RHEX may only be used once, to send the Device described in your Trade-In Order. We may cancel a shipping label that has not been used when your Trade-In Order is cancelled or expires under section 5. You must not use a cancelled label.

> **13. Accepting a Final Offer** *(replace the final two paragraphs)*
>
> You will have **7 days** from the date we notify you of a revised Final Offer to accept or reject it. We may send reminder notices during that period.
>
> If you do not respond within that period, we will treat the revised Final Offer as rejected and return your Device to the address you provided, in accordance with section 15.

Reviewer notes:
- Confirm the return-of-device clause number (assumed §15).
- D12: if the device is better than declared, RHEX pays the Indicative Quote. Consider stating this in §12 or §13.
