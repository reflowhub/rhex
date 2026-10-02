import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  TRADEIN_TERMS_EFFECTIVE_DATE,
  TRADEIN_TERMS_VERSION,
} from "@/lib/tradein-terms";

// ---------------------------------------------------------------------------
// GET /api/v1/terms — Current trade-in terms
// ---------------------------------------------------------------------------
// Mode C partners link the customer to these terms at checkout and send
// `termsVersion` with the acceptance (PUT /api/v1/quotes/{id}/accept).

export async function GET(request: NextRequest) {
  const result = await requireApiKey(request);
  if (result instanceof NextResponse) return result;

  const rl = await checkRateLimit(result.apiKeyId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhex.app";
  return NextResponse.json({
    version: TRADEIN_TERMS_VERSION,
    effectiveDate: TRADEIN_TERMS_EFFECTIVE_DATE,
    url: `${siteUrl}/terms/trade-in`,
  });
}
