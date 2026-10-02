# Send a shipping label

Every accepted trade-in needs a prepaid Australia Post label. The customer supplies the packaging.

## Find trade-ins that need a label

Go to **Trade-in Ops → Awaiting label**. It lists accepted trade-ins with no label, oldest first. The **Waiting** column turns amber after 2 days, so start at the top.

If a row looks fake (bot, test or nonsense details), [clear it out](clear-not-genuine.md) instead of sending a label.

## Send the label

1. Create the label in the Australia Post portal using the customer's name and address from the quote. Download it as a PDF.
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

## If something goes wrong

- **"Labels can only be sent while the quote is accepted."** Once a trade-in is marked shipped, you can't send or replace its label.
- **"The label must be a PDF"** or **"must be under 900 KB".** Download the label again from the portal as a PDF, one label per file.
