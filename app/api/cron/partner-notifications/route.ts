import { NextRequest, NextResponse } from "next/server";
import { processDuePartnerNotifications } from "@/lib/partner-notifications";

// ---------------------------------------------------------------------------
// GET|POST /api/cron/partner-notifications — Retry Mode C partner results
//
// Every 5 minutes (vercel.json). Delivers pending results whose
// nextAttemptAt has passed (first tries happen straight after the status
// change; see lib/partner-notifications.ts). Vercel Cron sends GET; POST is
// kept for manual runs. Needs the (status, nextAttemptAt) index.
//
// Auth: Bearer token matching CRON_SECRET env var.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const counts = await processDuePartnerNotifications();
    return NextResponse.json(counts);
  } catch (error) {
    console.error("partner-notifications cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
