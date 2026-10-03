# Cancel a trade-in

Cancel a trade-in when it should stop and we don't have the device. **Cancelling can't be undone.** The customer isn't emailed, except for partner trade-ins (see below).

## When you can cancel

| Status | Can you cancel? |
|---|---|
| Quoted, Accepted, Shipped | Yes |
| On Hold | Only if the device was surrendered to authorities |
| Anything else | No. Once we have the device it ends as Returned or Paid, not Cancelled. To send it back, see [Return a device](return-device.md). |

## Steps

1. Open the quote and click **Cancel Quote**.
2. Choose a **Reason**:

| Reason | Use when |
|---|---|
| Not genuine (bot, fake or test details) | Fake or test acceptance. To clear lots at once, see [Clear out fake acceptances](clear-not-genuine.md). |
| Customer asked to cancel | The customer changed their mind before sending the device |
| Duplicate acceptance | The customer accepted the same device twice. Cancel the extra one. |
| Lost in transit | Shipped, but Australia Post confirms it's lost |
| Surrendered to authorities | On Hold only: the device was handed to police or another authority |
| Other | Anything else. A note is required. |

3. Add a **Note** if it helps whoever reads it later.
4. Click **Cancel Quote**.

The reason shows in the Workflow box, on the Quotes list and in the History box.

## Good to know

- If an **Accepted** trade-in had a label, the unused label goes to [Labels to refund](refund-labels.md) automatically.
- A **Shipped** label has already been scanned, so it can't be refunded.
- Tell the customer yourself if they need to know. No email is sent, except for partner trade-ins.

## Partner trade-ins (such as OPPO)

When a partner trade-in is cancelled while it's **Accepted** or **Shipped**:

- The partner is told the trade-in isn't going ahead, so it won't refund the customer. This happens if the partner's **Never arrived** setting is on (it is for OPPO). The Cancel dialog warns you when it applies.
- The customer is emailed that the trade-in is cancelled when the reason is **Customer asked to cancel**, **Lost in transit** or **Other**, unless the partner has switched that email off. The Cancel dialog says whether an email will go. Fake and duplicate acceptances aren't emailed.
- If the device turns up later, it can't be received against this trade-in. See "Parcels for closed partner trade-ins" in [Receive a parcel](receive-parcel.md).
