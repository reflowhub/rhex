# Trade-ins: how it works

These guides cover single-device trade-ins: a customer gets a price for one device, accepts it, posts the device to us, and we pay them once we've checked it. Partner quotes (Mode A/B) and bulk quotes work differently and aren't covered here yet.

## The guides

Getting the device to us:

- [Create and accept a quote for a customer](create-and-accept.md)
- [Send a shipping label](send-label.md)
- [Clear out fake acceptances](clear-not-genuine.md)
- [Follow up an overdue parcel](overdue-parcel.md)

When the parcel arrives:

- [Receive a parcel](receive-parcel.md)
- [Log and resolve an unmatched parcel](unmatched-parcel.md)
- [Inspect and grade a device](inspect-device.md)
- [Decide on a late arrival](late-arrival.md)
- [Follow up a revised offer](revised-offer.md)
- [Put a trade-in on hold](on-hold.md)

Finishing up:

- [Pay the customer](pay-customer.md)
- [Return a device](return-device.md)
- [Cancel a trade-in](cancel.md)
- [Refund unused labels](refund-labels.md)

## The screens

- **Quotes** lists every quote. Filter by status, or search by customer name, email or TI- reference. Click a row to open the quote. Most actions happen on the quote page.
- **Trade-in Ops** has three work queues: **Awaiting label**, **Overdue** and **Labels to refund**. The **Receive Parcel** button opens the screen you use when a parcel arrives.

On the quote page, the **Workflow** box shows where the trade-in is and only shows the buttons that make sense right now. If you're looking for a button that isn't there, the trade-in is probably at a different step. The **History** box shows every status change, who made it and any reason they gave.

Once a customer accepts, the trade-in gets a reference like **TI-1042**. Customers see it in their emails and are asked to put it in the box. Use it when you talk to them.

## The journey

1. **Quoted.** The customer has a price but hasn't accepted. Quotes from the website last 24 hours. Quotes you create in admin last 14 days.
2. **Accepted.** The customer has accepted and given their contact and payout details. They now wait for us to email a prepaid Australia Post label.
3. **Shipped** *(optional)*. The customer pressed "I've posted it", or you marked it shipped. You can receive a parcel whether or not this happened.
4. **Received.** The parcel has arrived and you've recorded the device's IMEI or serial number.
5. **Inspected.** You've graded the device and the price is settled.
6. **Paid.** You've sent the payment and marked the trade-in paid. This is the end of the journey.

Other things that can happen along the way:

| Status | What it means | What you do |
|---|---|---|
| **Revised** | The device was worse than declared, so we offered a lower price. Waiting for the customer to accept or reject. | [Follow up a revised offer](revised-offer.md) |
| **On Hold** | Paused for an ownership, blacklist or fraud check. Customers see "Under Review". | [Put a trade-in on hold](on-hold.md) |
| **Returning** | We're sending the device back. | [Return a device](return-device.md) |
| **Returned** | The device has been sent back. Finished. | Nothing |
| **Expired** | The quote ran out before it was accepted, or it was accepted but never posted. | Nothing, unless the parcel turns up: you can still [receive](receive-parcel.md) it. |
| **Cancelled** | Stopped by an admin, with a reason. Finished. | Nothing |

## Deadlines after the label is sent

| Day | What happens |
|---|---|
| 0 | You send the label. The customer is told to post by day 14. |
| 7 | Automatic reminder email (skipped if marked shipped or received). |
| 12 | Automatic "post by" reminder (same rule). |
| 14 | **Post-by date.** Last day to lodge the parcel. |
| 24 | **Expected-by date.** Not received yet → shows in the **Overdue** queue. |
| 44 | Still not posted → the trade-in expires automatically, the customer is told not to use the label, and the label goes to the refund queue. |
| 75 | Unrefunded labels are flagged **Urgent**. |
| 90 | Australia Post's refund deadline. |

A parcel that arrives after the expected-by date is flagged as a **late arrival**. You'll need to [decide on it](late-arrival.md) before inspecting.

## Which actions email the customer

| Action | Email? |
|---|---|
| Customer accepts on the website | Yes: acceptance email |
| You accept for them (**Mark Accepted**) | No |
| **Send Label** / **Replace Label** | Yes: label attached |
| Day 7 and day 12 reminders, day 44 expiry | Yes, automatically |
| **Send Revised Offer** | Yes |
| **Mark Paid** | Yes: payment email |
| **Mark Returned** | Yes: device on its way back, with the return tracking number if you entered one |
| Put on hold, start a return (**Return Device**), cancel | **No.** Contact the customer yourself if they need to know. |

## Test quotes

Quotes marked **SANDBOX** are tests. They're hidden from the Quotes list unless you tick **Include sandbox**, they never send emails, and they don't appear in the Trade-in Ops queues.
