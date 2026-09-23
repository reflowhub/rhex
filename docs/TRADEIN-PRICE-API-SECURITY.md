# Trade-In Price Lookup API — Security Notes

## Context

The public endpoint `GET /api/tradein-price` was added to power the Clearvue iOS app integration. It returns Grade A and Grade C buy prices (in AUD) for Apple phones given a model and storage size.

The data exposed is low sensitivity (customer-facing pricing), but the endpoint is **unauthenticated and has no rate limiting**. A competitor could programmatically iterate model/storage combinations to scrape the full pricing matrix.

The endpoint is effectively publicly discoverable — the URL is visible in network traffic from the Clearvue app.

## Proposed Mitigations

### 1. Rate Limiting

Add per-IP rate limiting to prevent bulk scraping.

- **Option A: Vercel/CDN-level** — configure rate limit rules in the hosting platform (no code changes, fastest to ship)
- **Option B: Middleware-level** — add a simple in-memory or Redis-backed rate limiter in Next.js middleware for the `/api/tradein-price` route (e.g. 30 requests/minute per IP)

### 2. API Key Header

Require a shared secret in a request header (e.g. `X-API-Key`) that the Clearvue app includes with each call.

- Lightweight — no OAuth or session management needed
- Key is embedded in the Clearvue app binary (not truly secret, but raises the bar significantly vs. open access)
- Reject requests missing or mismatching the key with `401 Unauthorized`
- Rotate the key periodically or on suspected compromise, coordinating with the Clearvue app release cycle

### 3. Combined Approach (Recommended)

Apply both mitigations together:

1. **API key** blocks casual/automated discovery and generic scrapers
2. **Rate limiting** throttles any caller who obtains the key (e.g. via app reverse engineering)

This makes scraping the full matrix meaningfully harder without adding complexity for the Clearvue integration — just one extra header per request.

## Status

Not yet implemented. Revisit before or shortly after the Clearvue integration goes live.
