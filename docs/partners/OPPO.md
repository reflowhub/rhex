# OPPO AU: trade-in arrangement (Mode C)

Status: agreed 2026-10-02. OPPO AU is a Mode C partner (see `docs/PARTNERSHIP.md`).
OPPO's result API spec is in `docs/partners/oppo-trade-in-result-api.md`.

Timeline: sandbox dry run with OPPO on Wed 7 or Thu 8 October 2026; live for
OPPO's new device launch in late October 2026.

## Arrangement

- OPPO sells new phones on its online store (Shopify). Trade-in is only offered with a new-phone purchase.
- Reflow Hub is the **buyer** of every trade-in device. Title passes from the customer to Reflow, and the customer accepts Reflow's trade-in terms.
- OPPO is Reflow's agent **for payment only**. It refunds Reflow's trade-in value to the customer's original payment method as a Shopify partial refund.
- There are two separate values:
  - **Reflow's trade-in value**, from the RHEX API.
  - **OPPO's bonus credit**, from OPPO's own promotions. OPPO decides, funds and communicates it. RHEX never sees, shows or settles the bonus.
- Reflow handles logistics and customer communication: creating the AusPost label and sending it to the customer, reminders, receiving, data wipe, inspection, re-quotes, and queries about lost parcels.

### Flow

1. At checkout, OPPO calls the RHEX API to search for the device and create a quote at the partner price.
2. OPPO accepts the quote with the customer's details and terms consent.
3. RHEX creates the label and emails it to the customer.
4. The customer posts the device to Reflow. Reflow receives, wipes and inspects it.
5. Match → approved at the original price.
6. Mismatch → Reflow emails the customer a re-quote. The customer has 7 days to accept or decline. Declined or expired → Reflow returns the device at its own cost.
7. Final outcome → RHEX sends a signed PUT to OPPO, and OPPO refunds (or doesn't).

### Settlement

Settlement is between Reflow and OPPO only, as a periodic net statement:

| Outcome | Owed |
|---|---|
| Completed | Reflow owes OPPO the approved trade-in value. OPPO owes Reflow a processing fee of $20 + GST. |
| Re-quote declined, or device returned | OPPO owes Reflow $10 + GST. |
| Never shipped | No charges. |

All labels (inbound and return) are Reflow's own cost, tracked on `shippingLabels`, not settlement lines.

### Customer data

Reflow is the buyer, so it holds the customer's name, email, phone and address (dealer records, labels, returns, emails). It never holds bank or PayID details. Records are tagged with the source partner. No marketing without recorded opt-in consent (default false).

## Decided since

| Date | Decision |
|---|---|
| 2026-10-02 | Partner price = the public price (no partner discount). OPPO's prices are the website's AUD prices on the day: the NZD price list converted at that day's FX rate and rounded down to $5. A quote's AUD amount is fixed when it's created. |
| 2026-10-02 | Internally a completed Mode C quote ends as `paid` (the trade-in is complete for Reflow). The v1 API reports it to OPPO as `completed`, and customers see "Approved". |
| 2026-10-02 | Trade-ins that end without a customer decision (Reflow rejects the device and returns it, or it's surrendered to authorities) send OPPO `accepted: false` with the last offered price and grade. Default until OPPO confirms whether it prefers a price of 0. |
| 2026-10-02 | Staging webhook secret: the "API_Key" in OPPO's PDF (Trade-In Doc Web-hook API, v1.0, 25 Aug 2026). The PDF's auth (`X-Webhook-Secret` header) and `approvedGrading` field are out of date: a signed PUT per `oppo-trade-in-result-api.md` (HMAC, `acceptGrading`) to staging returned 404 for an unknown quote, and a wrong secret returned 401. Stored only as the Vercel env var `TRADE_IN_WEBHOOK_SECRET_SANDBOX`, never in the repo. |
| 2026-10-02 | Sandbox emails go to the address entered only if it's on OPPO's sandbox allow-list (`rex.zheng@oppomobile.com.au`, `terence+oppo@reflowhub.com`); everything else is redirected to `terence+oppo@reflowhub.com`. |
| 2026-10-02 | Mode C customer emails keep the "rhex" sender and are co-branded in the header and footer only (partner logo, "powered by Reflow Hub"). Support contact and reply-to: `support@reflowhub.com`; no phone number for now. |
| 2026-10-02 | No new trade-in terms for Mode C. OPPO's partial refund is a payment on Reflow's behalf; Reflow is the buyer and reimburses OPPO. |
| 2026-10-02 | Never arrived: one partner setting covers quotes that expire unposted, admin cancellations before arrival, and parcels lost after posting (shipped → cancelled). When on, RHEX sends `accepted: false` with the original price and grade. On for OPPO at launch. |
| 2026-10-02 | Once a Mode C result has been sent, the quote can't be received any more; a late device is returned. |
| 2026-10-02 | Re-quote emails include a reminder 48 hours before the 7-day deadline. |
| 2026-10-02 | OPPO expects about 200 trade-ins a month. |
| 2026-10-02 | Reflow handles logistics for now (inbound labels and returns). OPPO will say on 5 October 2026 whether it takes over inbound logistics and charges Reflow through settlement. Returns stay with Reflow either way, since Reflow has the device. |

## Build plan

Reuse the consumer trade-in flow (labels, reminders, receiving, expiry, re-quote, late arrivals) and map onto `docs/TRADEIN-STATES-PLAN.md`; no parallel flow. Propose each phase's plan for review before coding it.

**Phase 1 (dry run, 7–8 Oct): shipped 2026-10-02 (da079bb).** Mode C in v1 and the state machine, signed result outbox + retry cron, sandbox end to end (SBX- refs, email allow-list, OPPO staging), admin partner settings and result panel, Mode B trimmed. Checks: `npx tsx scripts/check-mode-c.ts` (rhex-test). Left to do: switch OPPO AU to Mode C in admin once OPPO sends the new accept fields.

**Phase 2 (by launch, late October):** plan agreed 2026-10-02, built for Reflow logistics.
- **2a. Unblock the Mode C switch: done 2026-10-02.** API keys can be issued to Mode C partners, a Mode C-only partner can be saved in admin, and the admin accept form takes first and last name (and no payout details) for Mode C.
- **2b. Co-branded emails: built 2026-10-02, in review.** One switch per customer email in the partner settings, all on by default; re-quote emails and the re-quote reminder can't be switched off. OPPO's answer on which emails it sends itself just sets its switches. Partner brand settings (display name, logo URL as an https PNG, support email, optional phone), read when each email is sent. A shared trade-in email layout; consumer emails are unchanged. Mode C emails: accepted, label, label reminders, received (new), re-quote with the 7-day deadline, re-quote reminder 48h before (new), returning (new: declined, expired or rejected), returned with tracking, approved (new, replaces the paid email), and closed unposted (no `/sell` link). Approved wording: "Your trade-in value of $X is approved. {partner} will refund $X to your original payment method. Any {partner} bonus credit is applied by {partner} under its promotion terms." Never show bonus amounts.
- **2c. Quote page for Mode C.** The public quote data includes the partner mode, name and logo, and no payout details. No accept form, payment fields, competitor comparison, review prompt or `/sell` links. Paid shows "Approved" with the refund wording; amounts in AUD and dates in en-AU. The feedback raffle rejects Mode C quotes.
- **2d. Never arrived.** The partner setting above. Mode C accepted quotes with no label after one business day show in the Awaiting label queue. Receiving is blocked once a result has been sent.
- **2e. Labels, production, API reference.**
  - Label volume: about 200 a month is roughly 10 labels a working day, or 30–50 minutes of manual work at 3–5 minutes each, so the manual flow holds at launch. Watch the launch-week spike, and propose AusPost API automation past about 30 a day (don't build without approval).
  - Labels record who provided and who paid for them, and returns get a `shippingLabels` entry with tracking and optional cost, so Phase 3 can add partner logistics charges if OPPO takes over logistics.
  - Production: issue an `rhx_` key, set the production result URL and `TRADE_IN_WEBHOOK_SECRET` once OPPO issues the secret, then switch OPPO AU to Mode C.
  - API reference: tidy `docs/API-REFERENCE.md` for OPPO (Mode C quote validity, required accept fields, address shape, terms consent, never-arrived outcome).

**Phase 3 (can follow launch):** settlement ledger. Per-quote entries created on the final outcome, amounts in AUD, fees ex-GST with GST separate. Per-partner fee config ($20 completed, $10 returned/declined). Net statement per period (period configurable, value TBC). Must backfill from quote history (`settlement` and `partnerResult` on quotes). Mode A payouts stay as they are.

## Still open

- **Never arrived:** OPPO to confirm `accepted: false` with the original price and grade (the setting is on until then). It can be turned off in admin without a deploy.
- **Customer emails:** OPPO may want RHEX to email customers only for re-quotes and send the rest itself. Its answer sets its email switches in admin (all on until then). OPPO's logo URL (https PNG) for the email header.
- **Logistics:** OPPO decides on 5 October 2026 whether it takes over inbound labels (eParcel) and charges Reflow through settlement.
- **Settlement:** the period and payment terms.
- **Blocklisted or locked devices:** the processing fee for devices that can't be returned.
- **Production webhook secret:** OPPO to issue one for production (separate from staging).
