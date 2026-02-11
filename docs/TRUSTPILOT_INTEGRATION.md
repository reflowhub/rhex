# Trustpilot Integration — Trade-In Website (React / Next.js)

## Overview

Three integration layers:
1. **Post-transaction redirect** — Send users to Trustpilot after completing a trade-in
2. **Automated review invitations** — Email invitations via Trustpilot's API
3. **Embedded review widgets** — Display reviews and TrustScore on your site

---

## Prerequisites

- **Trustpilot Business account** (paid plan required for API access and invitations)
- Register your domain on Trustpilot (`reflowhubtradein.com.au` or similar)
- Generate API credentials at https://businessapp.b2b.trustpilot.com → Integrations → API

You'll need:
- `TRUSTPILOT_API_KEY` (public)
- `TRUSTPILOT_API_SECRET`
- `TRUSTPILOT_BUSINESS_UNIT_ID` (your unique business ID on Trustpilot)
- `TRUSTPILOT_USERNAME` / `TRUSTPILOT_PASSWORD` (for OAuth token generation)

---

## 1. Post-Transaction Redirect to Trustpilot

The simplest approach — after a trade-in is confirmed, redirect or show a prompt linking to your Trustpilot review page.

### Trustpilot Review Link Format

```
https://www.trustpilot.com/evaluate/{your-domain}
```

Example: `https://www.trustpilot.com/evaluate/reflowhubtradein.com.au`

### React Component — Review Prompt

```tsx
// components/TrustpilotReviewPrompt.tsx
'use client';

import { useState } from 'react';

interface TrustpilotReviewPromptProps {
  customerName: string;
  orderId: string;
  domain?: string;
}

export function TrustpilotReviewPrompt({
  customerName,
  orderId,
  domain = 'reflowhubtradein.com.au',
}: TrustpilotReviewPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const reviewUrl = `https://www.trustpilot.com/evaluate/${domain}?stars=5`;

  return (
    <div className="bg-white border border-green-200 rounded-xl p-6 shadow-sm max-w-md mx-auto text-center">
      <div className="text-4xl mb-3">🎉</div>
      <h3 className="text-xl font-semibold mb-2">
        Trade-in confirmed, {customerName}!
      </h3>
      <p className="text-gray-600 mb-1">Order #{orderId}</p>
      <p className="text-gray-600 mb-4">
        We'd love to hear about your experience. It only takes 30 seconds!
      </p>

      <a
        href={reviewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-[#00b67a] hover:bg-[#009e6a] text-white font-medium py-3 px-6 rounded-lg transition-colors mb-3"
        onClick={() => {
          // Track the click
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'trustpilot_review_click', {
              order_id: orderId,
            });
          }
        }}
      >
        ⭐ Leave a Review on Trustpilot
      </a>

      <button
        onClick={() => setDismissed(true)}
        className="block mx-auto text-sm text-gray-400 hover:text-gray-600 mt-2"
      >
        Maybe later
      </button>
    </div>
  );
}
```

### Usage on Confirmation Page

```tsx
// app/trade-in/confirmation/page.tsx
import { TrustpilotReviewPrompt } from '@/components/TrustpilotReviewPrompt';

export default function ConfirmationPage({ searchParams }) {
  return (
    <main className="py-12">
      {/* Order details... */}

      <div className="mt-8">
        <TrustpilotReviewPrompt
          customerName="John"
          orderId={searchParams.orderId}
        />
      </div>
    </main>
  );
}
```

---

## 2. Automated Review Invitations (Email via API)

Trustpilot's invitation API lets you send branded review invitation emails automatically after a trade-in is processed.

### API Authentication — Get OAuth Token

```ts
// lib/trustpilot.ts
const TRUSTPILOT_API_BASE = 'https://api.trustpilot.com/v1';
const TRUSTPILOT_INVITATIONS_API = 'https://invitations-api.trustpilot.com/v1';

interface TrustpilotConfig {
  apiKey: string;
  apiSecret: string;
  username: string;
  password: string;
  businessUnitId: string;
}

const config: TrustpilotConfig = {
  apiKey: process.env.TRUSTPILOT_API_KEY!,
  apiSecret: process.env.TRUSTPILOT_API_SECRET!,
  username: process.env.TRUSTPILOT_USERNAME!,
  password: process.env.TRUSTPILOT_PASSWORD!,
  businessUnitId: process.env.TRUSTPILOT_BUSINESS_UNIT_ID!,
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`
  ).toString('base64');

  const res = await fetch(
    `${TRUSTPILOT_API_BASE}/oauth/oauth-business-users-for-applications/accesstoken`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: config.username,
        password: config.password,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Trustpilot auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}
```

### Send Review Invitation

```ts
// lib/trustpilot.ts (continued)

interface TradeInDetails {
  orderId: string;
  customerEmail: string;
  customerName: string;
  deviceModel: string;
  tradeInValue: number;
}

export async function sendReviewInvitation(tradeIn: TradeInDetails) {
  const token = await getAccessToken();

  const payload = {
    referenceNumber: tradeIn.orderId,
    consumerEmail: tradeIn.customerEmail,
    consumerName: tradeIn.customerName,
    locale: 'en-AU',
    senderEmail: 'noreply@reflowhubtradein.com.au',
    senderName: 'Reflow Hub Trade-In',
    replyTo: 'support@reflowhubtradein.com.au',
    // Send 1-3 days after transaction to let the customer receive payment
    preferredSendTime: new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000
    ).toISOString(),
    // Optional: tag with product info for Trustpilot product reviews
    products: [
      {
        productUrl: `https://reflowhubtradein.com.au/trade-in/${tradeIn.orderId}`,
        name: `Trade-In: ${tradeIn.deviceModel}`,
        sku: tradeIn.orderId,
      },
    ],
    // Service review link customization
    serviceReviewInvitation: {
      templateId: 'default', // Or use a custom template ID from Trustpilot dashboard
      redirectUri: 'https://reflowhubtradein.com.au/thank-you',
      tags: [
        { name: 'device', value: tradeIn.deviceModel },
        { name: 'value', value: String(tradeIn.tradeInValue) },
      ],
    },
  };

  const res = await fetch(
    `${TRUSTPILOT_INVITATIONS_API}/private/business-units/${config.businessUnitId}/email-invitations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    console.error('Trustpilot invitation failed:', error);
    throw new Error(`Trustpilot invitation failed: ${res.status}`);
  }

  return res.json();
}
```

### Trigger After Trade-In Completion

```ts
// app/api/trade-in/complete/route.ts
import { sendReviewInvitation } from '@/lib/trustpilot';

export async function POST(req: Request) {
  const tradeIn = await req.json();

  // ... process trade-in, update DB, trigger payment ...

  // Send Trustpilot review invitation (fire and forget)
  sendReviewInvitation({
    orderId: tradeIn.orderId,
    customerEmail: tradeIn.email,
    customerName: tradeIn.name,
    deviceModel: tradeIn.deviceModel,
    tradeInValue: tradeIn.payout,
  }).catch((err) => {
    console.error('Failed to send Trustpilot invite:', err);
    // Don't fail the trade-in if Trustpilot invite fails
  });

  return Response.json({ success: true });
}
```

### Environment Variables

```env
# .env.local
TRUSTPILOT_API_KEY=your_api_key
TRUSTPILOT_API_SECRET=your_api_secret
TRUSTPILOT_USERNAME=your_trustpilot_email
TRUSTPILOT_PASSWORD=your_trustpilot_password
TRUSTPILOT_BUSINESS_UNIT_ID=your_business_unit_id
```

---

## 3. Embed Trustpilot Reviews on Your Website

### Option A: Trustpilot TrustBox Widgets (Recommended — Easiest)

Trustpilot provides embeddable "TrustBox" widgets. You configure them in the
Trustpilot dashboard and embed via a script tag.

```tsx
// components/TrustpilotWidget.tsx
'use client';

import { useEffect, useRef } from 'react';

interface TrustpilotWidgetProps {
  templateId: string; // From Trustpilot widget configurator
  businessUnitId: string;
  height?: string;
  width?: string;
  theme?: 'light' | 'dark';
  stars?: string; // e.g. "4,5" to show only 4-5 star reviews
}

export function TrustpilotWidget({
  templateId,
  businessUnitId,
  height = '140px',
  width = '100%',
  theme = 'light',
  stars = '4,5',
}: TrustpilotWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Trustpilot widget script
    const existingScript = document.querySelector(
      'script[src*="tp.widget.bootstrap"]'
    );

    const initWidget = () => {
      if (window.Trustpilot && ref.current) {
        window.Trustpilot.loadFromElement(ref.current, true);
      }
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src =
        '//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }
  }, []);

  return (
    <div
      ref={ref}
      className="trustpilot-widget"
      data-locale="en-AU"
      data-template-id={templateId}
      data-businessunit-id={businessUnitId}
      data-style-height={height}
      data-style-width={width}
      data-theme={theme}
      data-stars={stars}
      data-review-languages="en"
    >
      <a
        href={`https://au.trustpilot.com/review/${businessUnitId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Trustpilot
      </a>
    </div>
  );
}

// Add to global types
declare global {
  interface Window {
    Trustpilot?: {
      loadFromElement: (element: HTMLElement, useNewApi: boolean) => void;
    };
  }
}
```

### Common TrustBox Template IDs

| Widget Type                | Template ID                          |
|---------------------------|--------------------------------------|
| Micro Review Count        | `5419b6a8b0d04a076446a9ad`           |
| Mini                      | `53aa8807dec7e10d38f59f32`           |
| Micro TrustScore          | `5419b637fa0340045cd0c936`           |
| Carousel                  | `53aa8912dec7e10d38f59f36`           |
| Starter (horizontal)      | `5613c9cde69ddc09340c6beb`           |
| Review Collector          | `56278e9abfbbba0bdcd568bc`           |

### Usage Examples

```tsx
// Homepage — show TrustScore badge
<TrustpilotWidget
  templateId="5419b6a8b0d04a076446a9ad"
  businessUnitId={process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID!}
  height="24px"
/>

// Landing page — review carousel
<TrustpilotWidget
  templateId="53aa8912dec7e10d38f59f36"
  businessUnitId={process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID!}
  height="180px"
  stars="4,5"
/>

// Trade-in page — starter widget
<TrustpilotWidget
  templateId="5613c9cde69ddc09340c6beb"
  businessUnitId={process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID!}
  height="140px"
/>
```

### Option B: Fetch Reviews via API (Custom Display)

If you want full control over how reviews look:

```ts
// lib/trustpilot.ts (continued)

export async function getReviews(page = 1, perPage = 5) {
  const res = await fetch(
    `${TRUSTPILOT_API_BASE}/business-units/${config.businessUnitId}/reviews?apikey=${config.apiKey}&page=${page}&perPage=${perPage}&orderBy=createdat.desc&stars=4,5`,
    { next: { revalidate: 3600 } } // Cache for 1 hour in Next.js
  );

  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}

export async function getBusinessUnit() {
  const res = await fetch(
    `${TRUSTPILOT_API_BASE}/business-units/${config.businessUnitId}?apikey=${config.apiKey}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) throw new Error('Failed to fetch business unit');
  return res.json();
}
```

```tsx
// components/TrustpilotReviews.tsx (Server Component)
import { getReviews, getBusinessUnit } from '@/lib/trustpilot';

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-lg ${i <= stars ? 'text-[#00b67a]' : 'text-gray-300'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export async function TrustpilotReviews() {
  const [reviewsData, businessData] = await Promise.all([
    getReviews(1, 6),
    getBusinessUnit(),
  ]);

  return (
    <section className="py-12">
      {/* Trust Score Header */}
      <div className="text-center mb-8">
        <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">
          Rated Excellent on Trustpilot
        </p>
        <div className="flex items-center justify-center gap-3">
          <StarRating stars={Math.round(businessData.score.trustScore)} />
          <span className="text-2xl font-bold">
            {businessData.score.trustScore.toFixed(1)}
          </span>
          <span className="text-gray-500">
            ({businessData.numberOfReviews.total} reviews)
          </span>
        </div>
      </div>

      {/* Review Cards */}
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {reviewsData.reviews.map((review: any) => (
          <div
            key={review.id}
            className="bg-white border rounded-lg p-5 shadow-sm"
          >
            <StarRating stars={review.stars} />
            <h4 className="font-semibold mt-2 mb-1">{review.title}</h4>
            <p className="text-gray-600 text-sm line-clamp-3">{review.text}</p>
            <p className="text-gray-400 text-xs mt-3">
              {review.consumer.displayName} •{' '}
              {new Date(review.createdAt).toLocaleDateString('en-AU')}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## Recommended Placement Strategy

| Page                  | Widget Type                 | Purpose                          |
|-----------------------|-----------------------------|----------------------------------|
| Homepage              | Micro TrustScore badge      | Instant credibility              |
| Homepage (below fold) | Review carousel             | Social proof                     |
| Trade-in form page    | Mini widget (sidebar)       | Reduce drop-off anxiety          |
| Confirmation page     | Review prompt + redirect    | Capture reviews                  |
| Footer (all pages)    | Micro review count          | Persistent trust signal          |

---

## Timing Strategy for Invitations

For trade-ins specifically, timing matters:

| Scenario                         | Send Invitation After |
|----------------------------------|----------------------|
| Instant quote + payment          | 1 day                |
| Device shipped → inspected       | 1 day after payment  |
| In-store trade-in                | Same day (evening)   |

Set `preferredSendTime` in the API call accordingly. Sending too early
(before payment) risks negative reviews from customers still waiting.

---

## Quick Start Checklist

- [ ] Create Trustpilot Business account
- [ ] Verify your domain
- [ ] Generate API credentials
- [ ] Add env variables to `.env.local` and hosting platform
- [ ] Add `TrustpilotWidget` to homepage and trade-in pages
- [ ] Add `TrustpilotReviewPrompt` to confirmation page
- [ ] Integrate `sendReviewInvitation()` into trade-in completion flow
- [ ] Test with a real transaction in Trustpilot sandbox/test mode
- [ ] Monitor invitation delivery in Trustpilot dashboard
