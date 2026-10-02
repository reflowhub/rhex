/**
 * End-to-end checks for Mode C (docs/partners/OPPO.md) and the Mode B
 * changes against the test Firebase project: v1-style acceptance, sandbox
 * SBX- references, the customer record, signed result notifications to a
 * local stub that verifies the signature like the partner's server, retries
 * (502 → retried, 401 → failed, admin retry), exactly-once queuing under
 * concurrency, and missing config. Creates its own data and deletes it
 * afterwards, restoring the trade-in counters.
 *
 * Usage: npx tsx scripts/check-mode-c.ts   (refuses to run unless .env.local
 * points at rhex-test; emails are skipped without RESEND_API_KEY)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { loadEnv } from "./load-env";
loadEnv();

const SECRET_ENV = "MODE_C_E2E_SECRET";
const SECRET = "e2e-secret-not-real";

interface Received {
  quoteId: string;
  body: Record<string, unknown>;
  signatureOk: boolean;
  timestampAgeMs: number;
}

/** Stub partner endpoint: PUT /api/trade-in/{quoteId}, verifies the HMAC. */
function startStub(respond: (quoteId: string, n: number) => number) {
  const received: Received[] = [];
  const counts = new Map<string, number>();
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const quoteId = decodeURIComponent((req.url ?? "").replace("/api/trade-in/", ""));
      const ts = String(req.headers["x-trade-in-timestamp"] ?? "");
      const sig = String(req.headers["x-trade-in-signature"] ?? "");
      const expected = createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
      const signatureOk =
        req.method === "PUT" &&
        sig.length === expected.length &&
        timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      const n = (counts.get(quoteId) ?? 0) + 1;
      counts.set(quoteId, n);
      received.push({ quoteId, body: JSON.parse(raw || "{}"), signatureOk, timestampAgeMs: Date.now() - Number(ts) });
      const status = signatureOk ? respond(quoteId, n) : 401;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: status === 200 ? 1 : 0 }));
    });
  });
  return new Promise<{ url: string; received: Received[]; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://localhost:${port}/api/trade-in/{quoteId}`,
        received,
        close: () => server.close(),
      });
    })
  );
}

async function main() {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID !== "rhex-test") throw new Error("not rhex-test");
  process.env[SECRET_ENV] = SECRET;

  const { adminDb } = await import("../lib/firebase-admin");
  const { transitionQuote } = await import("../lib/transition-quote");
  const { deliverPartnerNotification, retryPartnerNotification, PARTNER_NOTIFICATIONS } =
    await import("../lib/partner-notifications");
  const { TRADEIN_TERMS_VERSION } = await import("../lib/tradein-terms");
  const { v1QuoteStatus } = await import("../lib/v1-quote");
  const adminUser = { uid: "mode-c-test", email: "mode-c-test@rhex.local" };
  const check = (label: string, cond: unknown) => console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);

  // 502 the first time for quotes flagged "flaky", 401 for "reject" until reset
  const behaviour = new Map<string, "flaky" | "reject">();
  const stub = await startStub((quoteId, n) => {
    const b = behaviour.get(quoteId);
    if (b === "flaky" && n === 1) return 502;
    if (b === "reject") return 404;
    return 200;
  });

  const counters = ["counters/tradeIns", "counters/tradeInsSandbox"].map((p) => adminDb.doc(p));
  const countersBefore = await Promise.all(counters.map(async (c) => (await c.get()).data()));
  const createdQuotes: string[] = [];
  const testEmail = "mode-c-e2e@example.com";

  const partnerRef = await adminDb.collection("partners").add({
    name: "Mode C E2E Partner",
    status: "active",
    modes: ["C"],
    apiMode: "C",
    partnerRateDiscount: 0,
    resultWebhook: { url: stub.url, sandboxUrl: stub.url, secretEnv: SECRET_ENV, sandboxSecretEnv: SECRET_ENV },
    sandboxEmailAllowlist: [],
    sandboxEmailFallback: null,
  });
  const bPartnerRef = await adminDb.collection("partners").add({ name: "Mode B E2E Partner", status: "active", modes: ["B"] });

  const mkQuote = async (extra: Record<string, unknown> = {}) => {
    const ref = await adminDb.collection("quotes").add({
      deviceId: "IfQkjYXfghM98FwNeTyS", grade: "B", quotePriceNZD: 200, publicPriceNZD: 200, quotePriceDisplay: 180,
      displayCurrency: "AUD", fxRate: 0.9, status: "quoted", createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), partnerId: partnerRef.id, partnerMode: "C", source: "api", ...extra,
    });
    createdQuotes.push(ref.id);
    return ref;
  };
  const accept = {
    customerFirstName: "Mode",
    customerLastName: "Tester",
    customerEmail: testEmail,
    customerPhone: "0400000000",
    shippingAddress: { line1: "1 Test St", suburb: "Sydney", state: "NSW", postcode: "2000" },
    termsAccepted: true,
    termsVersion: TRADEIN_TERMS_VERSION,
  };
  const apiKey = { actor: "apiKey" as const, actorId: "e2e-key" };
  const admin = { actor: "admin" as const, admin: adminUser };
  const notificationsFor = async (quoteId: string) =>
    (await adminDb.collection(PARTNER_NOTIFICATIONS).where("quoteId", "==", quoteId).get()).docs;

  try {
    // --- Production Mode C: matched device → approved ---------------------
    const q = await mkQuote();
    const payRefused = await transitionQuote(q.id, "accepted", { ...apiKey, payload: { ...accept, paymentMethod: "payid", payIdPhone: "0400000123" } });
    check("payment details refused", !payRefused.ok);
    const noTerms = await transitionQuote(q.id, "accepted", { ...apiKey, payload: { ...accept, termsVersion: "old" } });
    check("stale terms version refused", !noTerms.ok);
    const byCustomer = await transitionQuote(q.id, "accepted", { actor: "customer", payload: accept });
    check("customer can't accept a Mode C quote", !byCustomer.ok && byCustomer.code === "forbidden");
    check("partner accepts with contact, address and consent", (await transitionQuote(q.id, "accepted", { ...apiKey, payload: accept })).ok);
    let d = (await q.get()).data()!;
    check(`TI- reference (${d.tradeInRef})`, /^TI-\d+$/.test(d.tradeInRef));
    check("name split and joined", d.customerFirstName === "Mode" && d.customerName === "Mode Tester");
    check("address stored in parts", d.shippingAddressParts?.state === "NSW" && typeof d.shippingAddress === "string");
    check("terms stored", d.termsVersion === TRADEIN_TERMS_VERSION && !!d.termsAcceptedAt);
    check("no payout details on the quote", !d.paymentMethod && !d.bankAccountNumber);
    const customer = d.customerId ? (await adminDb.collection("customers").doc(d.customerId).get()).data() : null;
    check("customer record tagged with the partner", customer?.sourcePartnerIds?.includes(partnerRef.id));
    check("customer record has no payout details", customer && !customer.paymentMethod && !customer.bankAccountNumber);
    check("marketing consent defaults to false", customer?.marketingConsent === false && d.marketingConsent === false);

    check("received", (await transitionQuote(q.id, "received", { ...admin, payload: { imei: "356789012345678" } })).ok);
    check("inspected at original (better grade A)", (await transitionQuote(q.id, "inspected", { ...admin, payload: { inspectionGrade: "A" } })).ok);
    check("no result sent before approval", stub.received.filter((r) => r.quoteId === q.id).length === 0);
    const [p1, p2] = await Promise.all([
      transitionQuote(q.id, "paid", admin),
      transitionQuote(q.id, "paid", admin),
    ]);
    check("concurrent approve: exactly one succeeds", [p1, p2].filter((r) => r.ok).length === 1);
    check("exactly one notification queued", (await notificationsFor(q.id)).length === 1);
    const sent = stub.received.filter((r) => r.quoteId === q.id);
    check("partner received one PUT", sent.length === 1);
    check("signature verifies", sent[0]?.signatureOk);
    check(`timestamp is fresh (${sent[0]?.timestampAgeMs}ms)`, sent[0] && sent[0].timestampAgeMs < 60_000);
    check(
      `body = original AUD price + original grade, accepted (${JSON.stringify(sent[0]?.body)})`,
      JSON.stringify(sent[0]?.body) === JSON.stringify({ approvedQuotePrice: 180, acceptGrading: "B", accepted: true })
    );
    d = (await q.get()).data()!;
    check("quote.partnerResult delivered", d.partnerResult?.status === "sent");
    check("settlement saved, no payout", d.settlement?.amount === 180 && d.settlement?.partnerId === partnerRef.id && !d.payout);
    check(`v1 reports "completed" (${v1QuoteStatus(d)})`, v1QuoteStatus(d) === "completed");

    // --- Sandbox Mode C: re-quote declined --------------------------------
    const s = await mkQuote({ sandbox: true });
    check("sandbox accept", (await transitionQuote(s.id, "accepted", { ...apiKey, payload: accept })).ok);
    d = (await s.get()).data()!;
    check(`sandbox SBX- reference (${d.tradeInRef})`, /^SBX-\d+$/.test(d.tradeInRef));
    check("sandbox: no customer record", !d.customerId);
    await transitionQuote(s.id, "received", { ...admin, payload: { imei: "356789012345679" } });
    check("revised to 150 NZD", (await transitionQuote(s.id, "revised", { ...admin, payload: { inspectionGrade: "C", revisedPriceNZD: 150 } })).ok);
    const partnerAnswers = await transitionQuote(s.id, "returning", apiKey);
    check("partner can't answer the re-quote", !partnerAnswers.ok && partnerAnswers.code === "forbidden");
    check("customer declines", (await transitionQuote(s.id, "returning", { actor: "customer" })).ok);
    const declined = stub.received.filter((r) => r.quoteId === s.id);
    check(
      `sandbox result to staging: revised AUD price + grade, not accepted (${JSON.stringify(declined[0]?.body)})`,
      declined.length === 1 && JSON.stringify(declined[0].body) === JSON.stringify({ approvedQuotePrice: 135, acceptGrading: "C", accepted: false })
    );

    // --- Retries --------------------------------------------------------
    const f = await mkQuote();
    behaviour.set(f.id, "flaky");
    await transitionQuote(f.id, "accepted", { ...apiKey, payload: accept });
    await transitionQuote(f.id, "received", { ...admin, payload: { imei: "356789012345670" } });
    await transitionQuote(f.id, "returning", { ...admin, reason: "iCloud locked" });
    let [n] = await notificationsFor(f.id);
    let nd = n.data();
    check(`502 → pending with backoff (${nd.status}, attempts ${nd.attempts})`, nd.status === "pending" && nd.attempts === 1 && nd.lastStatusCode === 502);
    const next = nd.nextAttemptAt.toDate() as Date;
    check(`next attempt ~1 minute later`, Math.abs(next.getTime() - Date.now() - 60_000) < 15_000);
    check("not retried before it's due", (await deliverPartnerNotification(n.id)) === null);
    check("retried once due → delivered", (await deliverPartnerNotification(n.id, new Date(next.getTime() + 1000))) === "sent");
    check("RHEX return → not accepted at the original price", JSON.stringify(stub.received.filter((r) => r.quoteId === f.id).at(-1)?.body) === JSON.stringify({ approvedQuotePrice: 180, acceptGrading: "B", accepted: false }));

    const r = await mkQuote();
    behaviour.set(r.id, "reject");
    await transitionQuote(r.id, "accepted", { ...apiKey, payload: accept });
    await transitionQuote(r.id, "received", { ...admin, payload: { imei: "356789012345671" } });
    await transitionQuote(r.id, "inspected", { ...admin, payload: { inspectionGrade: "B" } });
    await transitionQuote(r.id, "paid", admin);
    [n] = await notificationsFor(r.id);
    nd = n.data();
    check(`404 → failed without retry (${nd.status})`, nd.status === "failed" && nd.attempts === 1);
    check("quote shows the failure", (await r.get()).data()!.partnerResult?.status === "failed");
    behaviour.delete(r.id);
    const retried = await retryPartnerNotification(n.id, adminUser);
    check("admin Retry now delivers", retried.ok && retried.status === "sent");
    check("quote shows delivered after retry", (await r.get()).data()!.partnerResult?.status === "sent");

    // --- Missing config -------------------------------------------------
    await partnerRef.update({ "resultWebhook.secretEnv": "MODE_C_E2E_UNSET_SECRET" });
    const m = await mkQuote();
    await transitionQuote(m.id, "accepted", { ...apiKey, payload: accept });
    await transitionQuote(m.id, "received", { ...admin, payload: { imei: "356789012345672" } });
    await transitionQuote(m.id, "returning", { ...admin, reason: "Test" });
    [n] = await notificationsFor(m.id);
    nd = n.data();
    check(`missing secret → kept pending for retry (${nd.lastError})`, nd.status === "pending" && /isn't set/.test(nd.lastError));

    // --- Mode B ---------------------------------------------------------
    const b = await mkQuote({ partnerId: bPartnerRef.id, partnerMode: "B" });
    const bPay = await transitionQuote(b.id, "accepted", { ...apiKey, payload: { paymentMethod: "payid", payIdPhone: "0400000123" } });
    check("Mode B: payment details refused", !bPay.ok);
    check("Mode B: accepted with no customer contact", (await transitionQuote(b.id, "accepted", { ...apiKey, payload: {} })).ok);
    d = (await b.get()).data()!;
    check("Mode B: no customer record", !d.customerId);
    check("Mode B: no partner result", (await notificationsFor(b.id)).length === 0);
  } finally {
    stub.close();
    const notes = await adminDb.collection(PARTNER_NOTIFICATIONS).where("partnerId", "==", partnerRef.id).get();
    const customers = await adminDb.collection("customers").where("email", "==", testEmail).get();
    const batch = adminDb.batch();
    createdQuotes.forEach((id) => batch.delete(adminDb.collection("quotes").doc(id)));
    notes.docs.forEach((doc) => batch.delete(doc.ref));
    customers.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(partnerRef);
    batch.delete(bPartnerRef);
    counters.forEach((c, i) => (countersBefore[i] ? batch.set(c, countersBefore[i]!) : batch.delete(c)));
    await batch.commit();
    const audit = await adminDb.collection("quoteAuditLog").where("adminUid", "==", adminUser.uid).get();
    const auditBatch = adminDb.batch();
    audit.docs.forEach((doc) => auditBatch.delete(doc.ref));
    await auditBatch.commit();
    console.log(`cleaned up ${createdQuotes.length} quotes, ${notes.size} notifications, ${customers.size} customers`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
