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

## Still open

- **Never arrived:** when a Mode C quote expires unshipped, send OPPO the original price and grade with `accepted: false`. Proposed default, pending OPPO's confirmation; keep it behind config.
- **Settlement:** the period and payment terms.
- **Blocklisted or locked devices:** the processing fee for devices that can't be returned.
- **Production webhook secret:** OPPO to issue one for production (separate from staging).
