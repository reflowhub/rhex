# Rhex Trade-in Result API

This endpoint allows Rhex to submit the final trade-in assessment and the
customer's decision to OMC.

## Endpoint

Staging base URL:

```text
https://omc-business-platform-staging.fly.dev
```

```http
PUT /api/trade-in/{quoteId}
Content-Type: application/json
```

Use the `quoteId` associated with the trade-in in the URL. URL-encode it before
building the request URL.

## Authentication

Include these headers:

```http
x-trade-in-timestamp: <current Unix timestamp in milliseconds>
x-trade-in-signature: <lowercase hexadecimal HMAC-SHA256 signature>
```

Generate the signature using the shared `TRADE_IN_WEBHOOK_SECRET`, the timestamp
header and the exact raw JSON body sent in the request:

```text
HMAC_SHA256(TRADE_IN_WEBHOOK_SECRET, `${timestamp}.${rawBody}`)
```

The timestamp and signature are valid for 10 minutes. Generate a new timestamp
and signature for every request. Do not change the JSON body after generating
the signature.

The shared secret will be provided to Rhex separately and must not be stored in
source control or shared in this document.

## Request body

```json
{
  "approvedQuotePrice": 280,
  "acceptGrading": "B",
  "accepted": true
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `approvedQuotePrice` | number or numeric string | Yes | Final trade-in price, non-negative with no more than two decimal places. |
| `acceptGrading` | string | Yes | Final Rhex grading: `A`, `B`, `C`, `D`, or `E`. |
| `accepted` | boolean | Yes | Whether the customer accepted the final quote. |

When the customer declines the final quote, send the same final price and
grading with `"accepted": false`.

## Successful response

Status: `200 OK`

The response contains the updated trade-in record. The relevant values are:

```json
{
  "success": 1,
  "data": {
    "record": {
      "quoteId": "QUOTE-10001",
      "approvedQuotePrice": "280.00",
      "approvedGrading": "B",
      "accepted": true
    }
  }
}
```

The request field `acceptGrading` is returned as `approvedGrading` in the saved
trade-in record.

## Node.js signing example

```js
import { createHmac } from "node:crypto";

const quoteId = "QUOTE-10001";
const body = JSON.stringify({
  approvedQuotePrice: 280,
  acceptGrading: "B",
  accepted: true,
});
const timestamp = Date.now().toString();
const signature = createHmac("sha256", process.env.TRADE_IN_WEBHOOK_SECRET)
  .update(`${timestamp}.${body}`)
  .digest("hex");

const response = await fetch(
  `https://omc-business-platform-staging.fly.dev/api/trade-in/${encodeURIComponent(quoteId)}`,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-trade-in-timestamp": timestamp,
      "x-trade-in-signature": signature,
    },
    body,
  },
);
```

## Error responses

| Status | Meaning | Action |
|---:|---|---|
| `400` | The URL or request body is invalid. | Correct the request before retrying. |
| `401` | Signature headers are missing, invalid, or expired. | Generate a fresh timestamp and signature from the exact request body. |
| `404` | No trade-in exists for the supplied `quoteId`. | Confirm the `quoteId` with OMC. |
| `500` or `502` | OMC could not complete the request. | Retry with a fresh timestamp and signature; contact OMC if it continues. |
