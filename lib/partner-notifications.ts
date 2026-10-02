import admin, { adminDb } from "@/lib/firebase-admin";
import type { AdminSession } from "@/lib/admin-auth";
import { logQuoteAction } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import OpsAlertEmail from "@/emails/ops-alert";
import {
  classifyDelivery,
  isResultGrade,
  partnerResultUrl,
  retryDelayMs,
  type PartnerResultBody,
} from "@/lib/partner-result";
import { partnerResultHeaders } from "@/lib/partner-result-signing";
import type { QuoteStatus } from "@/lib/quote-status";
import { toDate } from "@/lib/quote-transitions";
import { serializeTimestamp } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// Partner result notifications (Mode C outbox)
// ---------------------------------------------------------------------------
// transitionQuote queues a `partnerNotifications` doc in the same transaction
// as a final Mode C outcome, so a result can't be lost. Delivery happens
// right after commit and then from /api/cron/partner-notifications with
// backoff (lib/partner-result.ts). Every attempt is signed at send time.
//
// Partner config (partners/{id}.resultWebhook):
//   url / sandboxUrl            — templates with {quoteId}, e.g.
//                                 https://…/api/trade-in/{quoteId}
//   secretEnv / sandboxSecretEnv — names of the env vars holding the secrets
// Secrets never live in Firestore.

export const PARTNER_NOTIFICATIONS = "partnerNotifications";

/** How long one attempt holds a notification, so two senders can't overlap. */
const LEASE_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_LOG_ENTRIES = 20;

export type PartnerNotificationStatus = "pending" | "sent" | "failed";

interface AttemptLogEntry {
  at: Date;
  statusCode: number | null;
  error: string | null;
}

/** Queue a result inside the transition's transaction. Returns the notification ID. */
export function queuePartnerResult(
  tx: FirebaseFirestore.Transaction,
  opts: {
    quoteId: string;
    partnerId: string | null;
    sandbox: boolean;
    body: PartnerResultBody;
    from: QuoteStatus;
    to: QuoteStatus;
    now: Date;
  }
): string {
  const ref = adminDb.collection(PARTNER_NOTIFICATIONS).doc();
  tx.set(ref, {
    type: "trade_in_result",
    quoteId: opts.quoteId,
    partnerId: opts.partnerId,
    sandbox: opts.sandbox,
    body: opts.body,
    // Signed exactly as stored, so retries send the same bytes
    rawBody: JSON.stringify(opts.body),
    transition: { from: opts.from, to: opts.to },
    status: "pending" satisfies PartnerNotificationStatus,
    attempts: 0,
    totalAttempts: 0,
    nextAttemptAt: opts.now,
    leaseUntil: null,
    lastStatusCode: null,
    lastError: null,
    lastResponse: null,
    attemptLog: [],
    createdAt: opts.now,
    sentAt: null,
    failedAt: null,
  });
  return ref.id;
}

interface AttemptResult {
  statusCode: number | null;
  error: string | null;
  response: string | null;
  /** The request can't succeed as it stands (e.g. invalid grade) */
  permanent?: boolean;
}

async function attempt(n: FirebaseFirestore.DocumentData, now: Date): Promise<AttemptResult> {
  const body = n.body as PartnerResultBody;
  if (!isResultGrade(body?.acceptGrading)) {
    return {
      statusCode: null,
      error: `Grade "${body?.acceptGrading}" isn't one the partner accepts (A–E)`,
      response: null,
      permanent: true,
    };
  }

  const partner = n.partnerId
    ? (await adminDb.collection("partners").doc(n.partnerId).get()).data()
    : undefined;
  const config = (partner?.resultWebhook ?? {}) as Record<string, unknown>;
  const urlTemplate = (n.sandbox ? config.sandboxUrl : config.url) as string | undefined;
  const secretEnv = (n.sandbox ? config.sandboxSecretEnv : config.secretEnv) as
    | string
    | undefined;
  const secret = secretEnv ? process.env[secretEnv] : undefined;
  if (!urlTemplate || !secret) {
    // Retried: the URL or secret may simply not be set up yet
    return {
      statusCode: null,
      error: !urlTemplate
        ? `No ${n.sandbox ? "sandbox " : ""}result URL in the partner's config`
        : `Secret env var ${secretEnv ?? "(not named in config)"} isn't set`,
      response: null,
    };
  }

  try {
    const res = await fetch(partnerResultUrl(urlTemplate, n.quoteId), {
      method: "PUT",
      headers: partnerResultHeaders(secret, n.rawBody, now),
      body: n.rawBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = (await res.text().catch(() => "")).slice(0, 500);
    return {
      statusCode: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
      response: text || null,
    };
  } catch (err) {
    return {
      statusCode: null,
      error: err instanceof Error ? err.message : String(err),
      response: null,
    };
  }
}

/**
 * Try to deliver one notification. Returns its status afterwards, or null if
 * it wasn't due (already sent or failed, or another attempt holds the lease).
 */
export async function deliverPartnerNotification(
  id: string,
  now: Date = new Date()
): Promise<PartnerNotificationStatus | null> {
  const ref = adminDb.collection(PARTNER_NOTIFICATIONS).doc(id);

  const claimed = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const n = snap.data()!;
    if (n.status !== "pending") return null;
    const due = toDate(n.nextAttemptAt);
    if (due && due.getTime() > now.getTime()) return null;
    const lease = toDate(n.leaseUntil);
    if (lease && lease.getTime() > now.getTime()) return null;
    const attempts = ((n.attempts as number) ?? 0) + 1;
    tx.update(ref, {
      attempts,
      totalAttempts: admin.firestore.FieldValue.increment(1),
      leaseUntil: new Date(now.getTime() + LEASE_MS),
    });
    return { ...n, attempts } as FirebaseFirestore.DocumentData & { attempts: number };
  });
  if (!claimed) return null;

  const result = await attempt(claimed, now);
  const outcome = result.permanent
    ? "failed"
    : classifyDelivery(result.statusCode, claimed.attempts);

  const log: AttemptLogEntry[] = [
    ...((claimed.attemptLog as AttemptLogEntry[]) ?? []),
    { at: now, statusCode: result.statusCode, error: result.error },
  ].slice(-MAX_LOG_ENTRIES);

  const update: Record<string, unknown> = {
    leaseUntil: null,
    lastStatusCode: result.statusCode,
    lastError: result.error,
    lastResponse: result.response,
    attemptLog: log,
  };
  if (outcome === "sent") {
    Object.assign(update, { status: "sent", sentAt: now });
  } else if (outcome === "retry") {
    update.nextAttemptAt = new Date(now.getTime() + retryDelayMs(claimed.attempts));
  } else {
    Object.assign(update, { status: "failed", failedAt: now });
  }
  await ref.update(update);

  if (outcome !== "retry") {
    await setQuoteResultStatus(claimed.quoteId, id, outcome, now);
  }
  if (outcome === "failed") await alertFailed(id, claimed, result);

  return outcome === "retry" ? "pending" : outcome;
}

/** Mirror the latest result's status on the quote (quote.partnerResult). */
async function setQuoteResultStatus(
  quoteId: string,
  notificationId: string,
  status: PartnerNotificationStatus,
  at: Date
): Promise<void> {
  const quoteRef = adminDb.collection("quotes").doc(quoteId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quoteRef);
    const current = snap.data()?.partnerResult as Record<string, unknown> | undefined;
    if (current?.notificationId !== notificationId) return;
    tx.update(quoteRef, {
      "partnerResult.status": status,
      "partnerResult.updatedAt": at,
    });
  });
}

async function alertFailed(
  id: string,
  n: FirebaseFirestore.DocumentData,
  result: AttemptResult
): Promise<void> {
  const to = process.env.OPS_ALERT_EMAIL;
  console.error(
    `Partner result ${id} for quote ${n.quoteId} failed after ${n.attempts} attempt(s): ${result.error}`
  );
  if (!to) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhex.app";
  const body = n.body as PartnerResultBody;
  await sendEmail({
    to,
    subject: `${n.sandbox ? "[SANDBOX] " : ""}Partner result failed for quote ${n.quoteId}`,
    react: OpsAlertEmail({
      title: "A trade-in result couldn't be delivered to the partner",
      details: [
        { label: "Quote", value: n.quoteId },
        { label: "Partner", value: n.partnerId ?? "unknown" },
        {
          label: "Result",
          value: `${body.accepted ? "accepted" : "not accepted"}, $${body.approvedQuotePrice}, grade ${body.acceptGrading}`,
        },
        { label: "Attempts", value: String(n.attempts) },
        { label: "Last error", value: result.error ?? "unknown" },
        ...(result.response ? [{ label: "Response", value: result.response }] : []),
      ],
      actionUrl: `${siteUrl}/admin/quotes/${n.quoteId}`,
      actionLabel: "Open the quote",
    }),
  });
}

/** Deliver every pending notification that is due (cron). */
export async function processDuePartnerNotifications(
  now: Date = new Date(),
  limit = 50
): Promise<{ due: number; sent: number; pending: number; failed: number }> {
  const snap = await adminDb
    .collection(PARTNER_NOTIFICATIONS)
    .where("status", "==", "pending")
    .where("nextAttemptAt", "<=", now)
    .orderBy("nextAttemptAt")
    .limit(limit)
    .get();

  const counts = { due: snap.size, sent: 0, pending: 0, failed: 0 };
  for (const doc of snap.docs) {
    const status = await deliverPartnerNotification(doc.id, now);
    if (status) counts[status]++;
  }
  return counts;
}

/** Admin "Retry now": reset the attempt count and send straight away. */
export async function retryPartnerNotification(
  id: string,
  adminUser: AdminSession
): Promise<
  | { ok: true; status: PartnerNotificationStatus | null }
  | { ok: false; status: number; error: string }
> {
  const ref = adminDb.collection(PARTNER_NOTIFICATIONS).doc(id);
  const now = new Date();
  const reset = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const, status: 404, error: "Notification not found" };
    const n = snap.data()!;
    if (n.status === "sent") {
      return { ok: false as const, status: 409, error: "This result was already delivered" };
    }
    tx.update(ref, {
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      leaseUntil: null,
      failedAt: null,
    });
    return { ok: true as const, quoteId: n.quoteId as string };
  });
  if (!reset.ok) return reset;

  await logQuoteAction({
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    quoteId: reset.quoteId,
    action: "partner_result_retry",
    details: { notificationId: id },
  });
  await setQuoteResultStatus(reset.quoteId, id, "pending", now);
  return { ok: true, status: await deliverPartnerNotification(id, now) };
}

/** A quote's notifications for the admin quote page, newest first. */
export async function listPartnerNotifications(quoteId: string) {
  const snap = await adminDb
    .collection(PARTNER_NOTIFICATIONS)
    .where("quoteId", "==", quoteId)
    .get();
  return snap.docs
    .map((doc) => {
      const n = doc.data();
      return {
        id: doc.id,
        status: n.status as PartnerNotificationStatus,
        body: n.body as PartnerResultBody,
        sandbox: n.sandbox === true,
        transition: n.transition ?? null,
        attempts: (n.totalAttempts as number) ?? 0,
        lastStatusCode: (n.lastStatusCode as number | null) ?? null,
        lastError: (n.lastError as string | null) ?? null,
        lastResponse: (n.lastResponse as string | null) ?? null,
        nextAttemptAt: serializeTimestamp(n.nextAttemptAt),
        createdAt: serializeTimestamp(n.createdAt),
        sentAt: serializeTimestamp(n.sentAt),
        failedAt: serializeTimestamp(n.failedAt),
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
