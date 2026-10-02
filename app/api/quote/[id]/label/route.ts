import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// GET /api/quote/[id]/label — Download the quote's current shipping label
// ---------------------------------------------------------------------------
// Like the quote page, access is by quote ID. Labels are only served while
// they can still be used (accepted or shipped).

const LABEL_STATUSES = ["accepted", "shipped"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`ip:${ip}:/api/quote/[id]/label`, 20);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { id } = await params;
    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    const quote = quoteDoc.data();
    if (
      !quote ||
      typeof quote.labelId !== "string" ||
      !LABEL_STATUSES.includes(quote.status)
    ) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const blob = await adminDb.collection("labelBlobs").doc(quote.labelId).get();
    const data = blob.data();
    if (!data?.data) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const pdf = Buffer.from(data.data as Uint8Array);
    const ref = (quote.tradeInRef as string) ?? id.slice(0, 8);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="RHEX-label-${ref}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error serving label:", error);
    return NextResponse.json(
      { error: "Failed to load label" },
      { status: 500 }
    );
  }
}
