# Send a shipping label

Every accepted trade-in needs a prepaid Australia Post label. The customer supplies the packaging.

## Find trade-ins that need a label

Go to **Trade-in Ops → Awaiting label**. It lists accepted trade-ins with no label, oldest first. The **Waiting** column turns amber after 2 days, so start at the top.

Partner trade-ins (such as OPPO) have a partner tag and a **Label due** date: the end of the next business day after the partner accepted (Sydney time, Monday to Friday). So a Monday trade-in is due by the end of Tuesday, and a Friday, Saturday or Sunday one by the end of Monday. Overdue ones turn red and move to the top, and the tab shows how many are overdue. Public holidays aren't counted, so allow for them yourself.

A partner can make its own labels instead (set per partner in **Partners → Shipping labels**). Those rows say **{partner}'s label** under the due date: see [When the partner makes the label](#when-the-partner-makes-the-label).

If a row looks fake (bot, test or nonsense details), [clear it out](clear-not-genuine.md) instead of sending a label.

## Send the label

1. Create the label in the Australia Post portal using the customer's name and address from the quote. The **Customer Details** box shows the address one line at a time (street, unit, then suburb, state and postcode), in the same order the portal asks for it. Download the label as a PDF.
2. In **Awaiting label**, click the row to open the quote.
3. In the **Shipping Label** box:
   - **Label PDF**: choose the PDF (must be under 900 KB).
   - **Tracking number**: copy it from the portal.
   - **Cost (AUD)**: optional, but it helps when tracking label spend.
4. Click **Send Label**.

The customer is emailed the label straight away. They have **14 days to post** the device. The Shipping Label box now shows the tracking number, the **Post by** date and the **Expected by** date.

The customer gets automatic reminders on day 7 and day 12 unless the parcel has been marked shipped or received.

## Replace a label

Use this if the label was wrong, or the customer lost it and needs a new one.

1. Create a new label in the Australia Post portal.
2. On the quote, fill in the **Shipping Label** form again and click **Replace Label**.

The new label is emailed, the 14-day post-by window **starts again**, and the old label goes to [Labels to refund](refund-labels.md).

## When the partner makes the label

Some partners make the inbound label themselves and send it to the customer. The quote's **Shipping Label** box then says it's waiting for the partner's label, and the form is set to **Label made by: {partner}**.

- **The partner records it for you.** It sends us the tracking number through the API, and the box fills in by itself. Nothing for you to do.
- **The partner sends you the tracking number** (for example by email). Enter the **Tracking number**, and the **Cost (AUD)** if the partner told you what it charges, then click **Record Label**. No email goes to the customer, because the partner has already sent the label. The 14 days to post start now.
- **The partner's label is overdue.** The due date and red flag work the same way as for our labels. Chase the partner first. If it can't send one, switch **Label made by** to **Reflow** and send our own label as usual. We pay for that one.

Partner labels never go to [Labels to refund](refund-labels.md): they're the partner's to cancel. The **Made / paid by** line on the quote shows who made the label and who pays for it.

## If something goes wrong

- **"Labels can only be sent while the quote is accepted."** Once a trade-in is marked shipped, you can't send or replace its label.
- **"The label must be a PDF"** or **"must be under 900 KB".** Download the label again from the portal as a PDF, one label per file.
