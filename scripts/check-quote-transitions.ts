/**
 * End-to-end checks for lib/transition-quote.ts and lib/shipping-labels.ts
 * against the test Firebase project: concurrent transitions, TI- references,
 * commission, audit log, lazy expiry (quoted, accepted, revised), label
 * reminders, sandbox handling, label send/replace/refund, "I've posted
 * it", money (revised price at the locked FX rate, payout snapshot,
 * customer totalValueNZD), late-arrival decisions and the customer timeline. Creates its own data and
 * deletes it afterwards, restoring counters/tradeIns to its previous value.
 *
 * Usage: npx tsx scripts/check-quote-transitions.ts   (refuses to run unless
 * .env.local points at rhex-test; emails are skipped without RESEND_API_KEY)
 */

import { loadEnv } from "./load-env";
loadEnv();

async function main() {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID !== "rhex-test") throw new Error("not rhex-test");
  const { adminDb } = await import("../lib/firebase-admin");
  const { transitionQuote } = await import("../lib/transition-quote");
  const { checkQuoteExpiry } = await import("../lib/quote-expiry");
  const { sendQuoteLabel, resolveLabelRefund, sendLabelReminder } = await import("../lib/shipping-labels");
  const { TRADEIN_TERMS_VERSION } = await import("../lib/tradein-terms");
  const { customerTimeline } = await import("../lib/quote-timeline");
  const { funnelStage } = await import("../lib/quote-status");
  const adminUser = { uid: "phase1-test", email: "phase1-test@rhex.local" };
  const created: string[] = [];
  const counterRef = adminDb.doc("counters/tradeIns");
  const counterBefore = (await counterRef.get()).data();
  const check = (label: string, cond: unknown) => console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);

  const partnerRef = await adminDb.collection("partners").add({ name: "Phase1 Test Partner", status: "active", modes: ["A"], commissionModel: "flat", commissionFlat: 7 });
  const mkQuote = async (extra: Record<string, unknown> = {}) => {
    const ref = await adminDb.collection("quotes").add({
      deviceId: "IfQkjYXfghM98FwNeTyS", grade: "A", quotePriceNZD: 200, quotePriceDisplay: 180,
      displayCurrency: "AUD", fxRate: 0.9, status: "quoted", createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), partnerId: partnerRef.id, partnerMode: "A", ...extra,
    });
    created.push(ref.id);
    return ref;
  };
  const details = { customerName: "Phase1 Test", customerEmail: "phase1-test@example.com", customerPhone: "0400000000", shippingAddressParts: { line1: "1 Test St", suburb: "Sydney", state: "NSW", postcode: "2000" }, paymentMethod: "payid", payIdPhone: "0400000123", termsAccepted: true };

  try {
    const q = await mkQuote();
    const [a1, a2] = await Promise.all([
      transitionQuote(q.id, "accepted", { actor: "customer", payload: details }),
      transitionQuote(q.id, "accepted", { actor: "customer", payload: details }),
    ]);
    check("concurrent accept: exactly one succeeds", [a1, a2].filter((r) => r.ok).length === 1);
    let d = (await q.get()).data()!;
    check(`TI reference assigned (${d.tradeInRef})`, /^TI-\d+$/.test(d.tradeInRef));
    check(`terms stored (${d.termsVersion})`, d.termsVersion === TRADEIN_TERMS_VERSION && !!d.termsAcceptedAt);
    check("customer linked", !!d.customerId);
    check("history has one entry", d.statusHistory?.length === 1 && d.statusHistory[0].actor === "customer");

    const noImei = await transitionQuote(q.id, "received", { actor: "admin", admin: adminUser });
    check(`receive without IMEI rejected (${!noImei.ok && noImei.message})`, !noImei.ok && noImei.code === "guard_failed");
    check("accepted → shipped (admin)", (await transitionQuote(q.id, "shipped", { actor: "admin", admin: adminUser })).ok);
    check("shipped → received with IMEI", (await transitionQuote(q.id, "received", { actor: "admin", admin: adminUser, payload: { imei: "356789012345678" } })).ok);
    const up = await transitionQuote(q.id, "revised", { actor: "admin", admin: adminUser, payload: { inspectionGrade: "B", revisedPriceNZD: 250 } });
    check("revision above original rejected", !up.ok);
    check("received → revised at 150", (await transitionQuote(q.id, "revised", { actor: "admin", admin: adminUser, payload: { inspectionGrade: "C", revisedPriceNZD: 150 } })).ok);
    d = (await q.get()).data()!;
    check("revisionExpiresAt set", !!d.revisionExpiresAt);
    check(`revisedPriceDisplay at locked FX 0.9 (${d.revisedPriceDisplay})`, d.revisedPriceDisplay === 135);
    check("customer accepts revision", (await transitionQuote(q.id, "inspected", { actor: "customer" })).ok);
    check("inspected → on_hold", (await transitionQuote(q.id, "on_hold", { actor: "admin", admin: adminUser, reason: "Blacklist check" })).ok);
    const paidWhileHeld = await transitionQuote(q.id, "paid", { actor: "admin", admin: adminUser });
    check("paid blocked while on hold", !paidWhileHeld.ok);
    check("release back to inspected", (await transitionQuote(q.id, "inspected", { actor: "admin", admin: adminUser, reason: "Clear" })).ok);
    const [p1, p2] = await Promise.all([
      transitionQuote(q.id, "paid", { actor: "admin", admin: adminUser }),
      transitionQuote(q.id, "paid", { actor: "admin", admin: adminUser }),
    ]);
    check("concurrent paid: exactly one succeeds", [p1, p2].filter((r) => r.ok).length === 1);
    const ledger = await adminDb.collection("commissionLedger").where("quoteId", "==", q.id).get();
    check(`one commission entry (${ledger.docs.map((x) => x.id).join(",")})`, ledger.size === 1 && ledger.docs[0].id === `quote_${q.id}`);
    check(`commission on the revised NZD price (${ledger.docs[0]?.data().quoteTotal})`, ledger.docs[0]?.data().quoteTotal === 150);
    d = (await q.get()).data()!;
    const po = d.payout ?? {};
    check(`payout snapshot: ${po.amount} ${po.currency} / ${po.amountNZD} NZD, ${po.method} ${po.payIdPhone}, by ${po.paidBy}`, po.amount === 135 && po.currency === "AUD" && po.amountNZD === 150 && po.method === "payid" && po.payIdPhone === "•••• 123" && po.paidBy === adminUser.email && !!po.paidAt);
    check(`history entries: ${d.statusHistory.map((e: { to: string }) => e.to).join(" → ")}`, d.statusHistory.length === 8);
    const timeline = customerTimeline(d);
    check(`customer timeline: ${timeline.map((e) => e.step).join(" → ")}`, timeline.map((e) => e.step).join(",") === "quoted,accepted,shipped,received,revised,inspected,on_hold,paid");
    check("customer timeline carries no actor or reason", !JSON.stringify(timeline).includes("Blacklist") && timeline.every((e) => Object.keys(e).join(",") === "step,at"));
    check("funnel stage paid", funnelStage(d) === "paid");
    const audit = await adminDb.collection("quoteAuditLog").where("quoteId", "==", q.id).get();
    check(`admin audit entries (${audit.size})`, audit.size === 6);
    check("cancel from paid blocked (D4)", !(await transitionQuote(q.id, "cancelled", { actor: "admin", admin: adminUser, payload: { cancelReason: "other" }, reason: "x" })).ok);

    // Lazy revision expiry through the module
    const r = await mkQuote({ status: "revised", revisionExpiresAt: new Date(Date.now() - 1000), customerEmail: "phase1-test@example.com" });
    check("checkQuoteExpiry moves an expired revision", await checkQuoteExpiry("quotes", r.id));
    const rd = (await r.get()).data()!;
    check("auto-expired via system actor", rd.status === "returning" && rd.revisionAutoExpired === true && rd.statusHistory?.[0]?.actor === "system");

    // Sandbox skips reference and side effects
    const s = await mkQuote({ sandbox: true });
    await transitionQuote(s.id, "accepted", { actor: "apiKey", actorId: "key1", payload: details });
    const sd = (await s.get()).data()!;
    check("sandbox: accepted without reference or customer link", sd.status === "accepted" && !sd.tradeInRef && !sd.customerId);

    // Shipping labels
    const l = await mkQuote();
    await transitionQuote(l.id, "accepted", { actor: "customer", payload: details });
    const pdf = Buffer.from("%PDF-1.4\n% test label\n");
    const label = (n: string, replaceLabelId?: string) =>
      sendQuoteLabel(l.id, { pdf, fileName: "label.pdf", trackingNumber: n, labelCostAUD: 12.5, admin: adminUser, replaceLabelId });
    const shippedEarly = await transitionQuote(l.id, "shipped", { actor: "customer" });
    check("customer can't mark posted before a label", !shippedEarly.ok);
    const [s1, s2] = await Promise.all([label("33AAA0000001"), label("33AAA0000001")]);
    check("concurrent label send: exactly one succeeds", [s1, s2].filter((r) => r.ok).length === 1);
    const first = (s1.ok ? s1 : s2) as { ok: true; labelId: string };
    let ld = (await l.get()).data()!;
    const days = (a: unknown, b: unknown) => Math.round(((b as { toMillis(): number }).toMillis() - (a as { toMillis(): number }).toMillis()) / 86400000);
    check(`deadlines: post by +${days(ld.labelSentAt, ld.postByAt)}d, expected +${days(ld.postByAt, ld.expectedByAt)}d`, days(ld.labelSentAt, ld.postByAt) === 14 && days(ld.postByAt, ld.expectedByAt) === 10);
    const blob = (await adminDb.collection("labelBlobs").doc(first.labelId).get()).data();
    check("label PDF stored", Buffer.from(blob?.data).toString().startsWith("%PDF-"));
    const replaced = await label("33AAA0000002", first.labelId);
    check("replace label", replaced.ok);
    const oldLabel = (await adminDb.collection("shippingLabels").doc(first.labelId).get()).data()!;
    check("replaced label queued for refund", oldLabel.status === "replaced" && oldLabel.refundState === "pending");
    check("stale replace rejected", !(await label("33AAA0000003", first.labelId)).ok);
    check("refund resolved", (await resolveLabelRefund(first.labelId, "refunded", adminUser)).ok);
    check("customer marks posted", (await transitionQuote(l.id, "shipped", { actor: "customer" })).ok);

    // Cancelling an accepted quote with a label queues it for refund
    const c = await mkQuote();
    await transitionQuote(c.id, "accepted", { actor: "customer", payload: details });
    const cl = await sendQuoteLabel(c.id, { pdf, fileName: "label.pdf", trackingNumber: "33AAA0000009", labelCostAUD: null, admin: adminUser });
    await transitionQuote(c.id, "cancelled", { actor: "admin", admin: adminUser, payload: { cancelReason: "customer_request" } });
    const cancelledLabel = cl.ok ? (await adminDb.collection("shippingLabels").doc(cl.labelId).get()).data() : null;
    check("cancel queues the label for refund", cancelledLabel?.refundState === "pending");

    // Phase 3: deadlines (lazy check; the cron uses the same transitions) and reminders
    const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);
    const ex = await mkQuote({ expiresAt: daysFromNow(-0.01) });
    check("open after expiresAt: quoted → expired", (await checkQuoteExpiry("quotes", ex.id)) && (await ex.get()).data()!.status === "expired");
    check("expired quote can't be accepted", !(await transitionQuote(ex.id, "accepted", { actor: "customer", payload: details })).ok);

    const un = await mkQuote();
    await transitionQuote(un.id, "accepted", { actor: "customer", payload: details });
    const ul = await sendQuoteLabel(un.id, { pdf, fileName: "label.pdf", trackingNumber: "33AAA0000010", labelCostAUD: null, admin: adminUser });
    check("accepted quote not expired before postByAt + 30d", !(await checkQuoteExpiry("quotes", un.id)));
    await un.update({ labelSentAt: daysFromNow(-45), postByAt: daysFromNow(-31), expectedByAt: daysFromNow(-21) });
    check("unposted at day 45: accepted → expired", (await checkQuoteExpiry("quotes", un.id)) && (await un.get()).data()!.status === "expired");
    const unLabel = ul.ok ? (await adminDb.collection("shippingLabels").doc(ul.labelId).get()).data() : null;
    check("expired quote's label queued for refund", unLabel?.refundState === "pending");
    check("expired-after-acceptance can still be received", (await transitionQuote(un.id, "received", { actor: "admin", admin: adminUser, payload: { imei: "356789012345678" } })).ok && (await un.get()).data()!.lateArrival === true);
    const noDecision = await transitionQuote(un.id, "inspected", { actor: "admin", admin: adminUser, payload: { inspectionGrade: "A" } });
    check(`late arrival can't be inspected without a decision (${!noDecision.ok && noDecision.message})`, !noDecision.ok && noDecision.code === "guard_failed");
    check("late arrival inspected with reassess", (await transitionQuote(un.id, "inspected", { actor: "admin", admin: adminUser, payload: { inspectionGrade: "A", lateDecision: "reassess", lateDecisionNote: "First scan day 20" } })).ok);
    const und = (await un.get()).data()!;
    check(`late decision stored (${und.lateDecision}, ${und.lateDecisionNote})`, und.lateDecision === "reassess" && und.lateDecisionNote === "First scan day 20");

    const rm = await mkQuote();
    await transitionQuote(rm.id, "accepted", { actor: "customer", payload: details });
    const rl = await sendQuoteLabel(rm.id, { pdf, fileName: "label.pdf", trackingNumber: "33AAA0000011", labelCostAUD: null, admin: adminUser });
    check("no reminder on day 0", (await sendLabelReminder(rm.id)) === null);
    await rm.update({ labelSentAt: daysFromNow(-7), postByAt: daysFromNow(7) });
    const [r1, r2] = await Promise.all([sendLabelReminder(rm.id), sendLabelReminder(rm.id)]);
    check(`concurrent day-7 reminder: sent once (${r1}, ${r2})`, [r1, r2].filter((x) => x === "day7").length === 1 && [r1, r2].includes(null));
    await rm.update({ labelSentAt: daysFromNow(-12), postByAt: daysFromNow(2) });
    check("day-12 reminder", (await sendLabelReminder(rm.id)) === "day12");
    check("no third reminder", (await sendLabelReminder(rm.id)) === null);
    const rr = rl.ok ? await sendQuoteLabel(rm.id, { pdf, fileName: "label.pdf", trackingNumber: "33AAA0000012", labelCostAUD: null, admin: adminUser, replaceLabelId: rl.labelId }) : null;
    const rmd = (await rm.get()).data()!;
    check("replacement label resets reminders", !!rr?.ok && Object.keys(rmd.remindersSent ?? {}).length === 0);
    await rm.update({ labelSentAt: daysFromNow(-7), postByAt: daysFromNow(7) });
    await transitionQuote(rm.id, "shipped", { actor: "customer" });
    check("no reminder once marked posted", (await sendLabelReminder(rm.id)) === null);

    // Phase 4: revision guard in the customer's currency, customer totals
    const fx = await mkQuote({ fxRate: 0.92, quotePriceDisplay: 180, status: "received", acceptedAt: new Date() });
    const flat = await transitionQuote(fx.id, "revised", { actor: "admin", admin: adminUser, payload: { inspectionGrade: "C", revisedPriceNZD: 199 } });
    check(`revision not lower in AUD rejected (${!flat.ok && flat.message})`, !flat.ok && flat.code === "guard_failed");

    const customerTotal = async (ref: FirebaseFirestore.DocumentReference) => {
      const cid = (await ref.get()).data()!.customerId;
      return (await adminDb.collection("customers").doc(cid).get()).data()!.totalValueNZD;
    };
    const cv = await mkQuote();
    await transitionQuote(cv.id, "accepted", { actor: "customer", payload: { ...details, customerEmail: "phase4-cancel@example.com" } });
    check(`accept credits the customer (${await customerTotal(cv)})`, (await customerTotal(cv)) === 200 && (await cv.get()).data()!.customerValueNZD === 200);
    await transitionQuote(cv.id, "cancelled", { actor: "admin", admin: adminUser, payload: { cancelReason: "customer_request" } });
    check(`cancel reverses it (${await customerTotal(cv)})`, (await customerTotal(cv)) === 0 && (await cv.get()).data()!.customerValueNZD === 0);

    const ev = await mkQuote();
    await transitionQuote(ev.id, "accepted", { actor: "customer", payload: { ...details, customerEmail: "phase4-expire@example.com" } });
    await sendQuoteLabel(ev.id, { pdf, fileName: "label.pdf", trackingNumber: "33AAA0000020", labelCostAUD: null, admin: adminUser });
    await ev.update({ labelSentAt: daysFromNow(-45), postByAt: daysFromNow(-31), expectedByAt: daysFromNow(-21) });
    await checkQuoteExpiry("quotes", ev.id);
    check(`expiry reverses it (${await customerTotal(ev)})`, (await customerTotal(ev)) === 0);
    await transitionQuote(ev.id, "received", { actor: "admin", admin: adminUser, payload: { imei: "356789012345678" } });
    check(`receiving after expiry restores it (${await customerTotal(ev)})`, (await customerTotal(ev)) === 200);
    check("returned reverses it again", (await transitionQuote(ev.id, "returning", { actor: "admin", admin: adminUser, reason: "Rejected" })).ok && (await transitionQuote(ev.id, "returned", { actor: "admin", admin: adminUser })).ok && (await customerTotal(ev)) === 0);
  } finally {
    // Clean up everything this run created
    for (const id of created) {
      const data = (await adminDb.collection("quotes").doc(id).get()).data();
      if (data?.customerId) await adminDb.collection("customers").doc(data.customerId).delete();
      for (const col of ["commissionLedger", "quoteAuditLog", "shippingLabels", "labelBlobs"]) {
        const docs = await adminDb.collection(col).where("quoteId", "==", id).get();
        await Promise.all(docs.docs.map((x) => x.ref.delete()));
      }
      await adminDb.collection("quotes").doc(id).delete();
    }
    await partnerRef.delete();
    // References used by this run's (deleted) quotes can be reused
    if (counterBefore) await counterRef.set(counterBefore);
    else await counterRef.delete();
    console.log("cleaned up");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
