import { describe, expect, it } from "vitest";
import {
  QUOTE_STATUSES,
  type QuoteActor,
  type QuoteStatus,
} from "@/lib/quote-status";
import {
  DEFAULT_REVISION_RESPONSE_DAYS,
  allowedTransitions,
  dueRevisionReminder,
  dueSystemTransition,
  planTransition,
  type QuoteData,
  type TransitionContext,
} from "@/lib/quote-transitions";
import { TRADEIN_TERMS_VERSION } from "@/lib/tradein-terms";

const ACTORS: QuoteActor[] = ["customer", "partner", "apiKey", "admin", "system"];

const NOW = new Date("2026-10-02T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const past = (days = 1) => new Date(NOW.getTime() - days * DAY);
const future = (days = 1) => new Date(NOW.getTime() + days * DAY);

/**
 * The transition table from docs/TRADEIN-STATES-PLAN.md §3, kept separate
 * from the implementation so a change to either shows up here.
 */
const EXPECTED: Record<string, QuoteActor[]> = {
  "quoted>accepted": ["customer", "apiKey", "admin"],
  "quoted>expired": ["system"],
  "quoted>cancelled": ["admin"],
  "accepted>shipped": ["customer", "admin"],
  "accepted>received": ["admin"],
  "accepted>expired": ["system"],
  "accepted>cancelled": ["admin"],
  "shipped>received": ["admin"],
  "shipped>cancelled": ["admin"],
  "expired>received": ["admin"],
  "received>inspected": ["admin"],
  "received>revised": ["admin"],
  "received>returning": ["admin"],
  "received>on_hold": ["admin"],
  "inspected>on_hold": ["admin"],
  "on_hold>received": ["admin"],
  "on_hold>inspected": ["admin"],
  "on_hold>returning": ["admin"],
  "on_hold>cancelled": ["admin"],
  "revised>inspected": ["customer", "partner", "apiKey", "admin"],
  "revised>returning": ["customer", "partner", "apiKey", "system"],
  "inspected>paid": ["admin"],
  "inspected>returning": ["admin"],
  "returning>returned": ["admin"],
};

const CUSTOMER_DETAILS = {
  customerName: "Sam Seller",
  customerEmail: "sam@example.com",
  customerPhone: "0400000000",
  shippingAddress: "1 Test St, Sydney NSW 2000",
  shippingAddressParts: { line1: "1 Test St", suburb: "Sydney", state: "NSW", postcode: "2000" },
  paymentMethod: "payid",
  payIdPhone: "0400000123",
};

function quote(status: QuoteStatus, extra: QuoteData = {}): QuoteData {
  return {
    status,
    grade: "A",
    quotePriceNZD: 200,
    createdAt: past(3),
    expiresAt: future(10),
    ...extra,
  };
}

function ctx(
  actor: QuoteActor,
  extra: Partial<TransitionContext> = {}
): TransitionContext {
  return { actor, now: NOW, ...extra };
}

/** A quote, payload and reason that satisfy every guard for a transition. */
function validCase(
  from: QuoteStatus,
  to: QuoteStatus,
  actor: QuoteActor
): { q: QuoteData; c: TransitionContext } {
  const key = `${from}>${to}`;
  const base: QuoteData = {
    ...CUSTOMER_DETAILS,
    acceptedAt: past(5),
    labelSentAt: past(50),
    postByAt: past(40),
    revisionExpiresAt: actor === "system" ? past() : future(5),
    expiresAt: key === "quoted>expired" ? past() : future(10),
    heldFrom: from === "on_hold" && to !== "returning" && to !== "cancelled" ? to : "received",
  };
  const payload: Record<string, unknown> = {};
  let reason: string | null = null;

  switch (key) {
    case "quoted>accepted":
      payload.termsAccepted = true;
      payload.shippingAddressParts = CUSTOMER_DETAILS.shippingAddressParts;
      break;
    case "accepted>received":
    case "shipped>received":
    case "expired>received":
      payload.imei = "356789012345678";
      break;
    case "quoted>cancelled":
    case "accepted>cancelled":
    case "shipped>cancelled":
      payload.cancelReason = "customer_request";
      break;
    case "on_hold>cancelled":
      payload.cancelReason = "surrendered";
      break;
    case "received>inspected":
      payload.inspectionGrade = "A";
      break;
    case "received>revised":
      payload.inspectionGrade = "C";
      payload.revisedPriceNZD = 150;
      break;
    case "received>returning":
    case "inspected>returning":
    case "on_hold>returning":
    case "received>on_hold":
    case "inspected>on_hold":
    case "on_hold>received":
    case "on_hold>inspected":
      reason = "Checked with the customer";
      break;
    case "revised>inspected":
      if (actor === "admin") reason = "Customer agreed by phone";
      break;
  }

  return {
    q: quote(from, base),
    c: ctx(actor, { payload, reason }),
  };
}

// ---------------------------------------------------------------------------
// The table: every move, every actor
// ---------------------------------------------------------------------------

describe("transition table", () => {
  for (const from of QUOTE_STATUSES) {
    for (const to of QUOTE_STATUSES) {
      const key = `${from}>${to}`;
      const allowedActors = EXPECTED[key];

      for (const actor of ACTORS) {
        if (!allowedActors) {
          it(`${key} is never allowed (${actor})`, () => {
            const { q, c } = validCase(from, to, actor);
            const plan = planTransition(q, to, c);
            expect(plan.ok).toBe(false);
            if (!plan.ok) expect(plan.code).toBe("invalid_transition");
          });
        } else if (!allowedActors.includes(actor)) {
          it(`${key} is forbidden for ${actor}`, () => {
            const { q, c } = validCase(from, to, actor);
            const plan = planTransition(q, to, c);
            expect(plan.ok).toBe(false);
            if (!plan.ok) expect(plan.code).toBe("forbidden");
          });
        } else {
          it(`${key} is allowed for ${actor}`, () => {
            const { q, c } = validCase(from, to, actor);
            const plan = planTransition(q, to, c);
            expect(plan).toMatchObject({ ok: true, from, to });
          });
        }
      }
    }
  }

  it("removed transitions stay removed (D4, D5)", () => {
    for (const from of ["paid", "received", "revised", "inspected", "returning"] as const) {
      const plan = planTransition(
        quote(from),
        "cancelled",
        ctx("admin", { payload: { cancelReason: "other" }, reason: "x" })
      );
      expect(plan.ok).toBe(false);
    }
  });

  it("rejects an unknown current status", () => {
    const plan = planTransition(quote("quoted", { status: "bogus" }), "accepted", ctx("admin"));
    expect(plan).toMatchObject({ ok: false, code: "invalid_transition" });
  });
});

// ---------------------------------------------------------------------------
// What every transition writes
// ---------------------------------------------------------------------------

describe("common writes", () => {
  it("writes status, timestamp and a statusHistory entry", () => {
    const q = quote("returning", {
      statusHistory: [{ from: "received", to: "returning" }],
    });
    const plan = planTransition(
      q,
      "returned",
      ctx("admin", { actorId: "ops@rhex.app", reason: "Posted back" })
    );
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.status).toBe("returned");
    expect(plan.update.returnedAt).toEqual(NOW);
    expect(plan.update.statusHistory).toEqual([
      { from: "received", to: "returning" },
      {
        from: "returning",
        to: "returned",
        actor: "admin",
        actorId: "ops@rhex.app",
        at: NOW,
        reason: "Posted back",
      },
    ]);
  });

  it("keeps the first timestamp when a status is reached again", () => {
    const receivedAt = past(2);
    const plan = planTransition(
      quote("on_hold", { heldFrom: "received", receivedAt }),
      "received",
      ctx("admin", { reason: "Ownership confirmed" })
    );
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.receivedAt).toBeUndefined();
    expect(plan.update.releaseNote).toBe("Ownership confirmed");
  });
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

describe("quoted → accepted", () => {
  const accept = (
    q: QuoteData,
    actor: QuoteActor,
    payload: Record<string, unknown>
  ) => planTransition(q, "accepted", ctx(actor, { payload }));

  it("rejects an expired quote", () => {
    const plan = accept(quote("quoted", { expiresAt: past() }), "customer", {
      ...CUSTOMER_DETAILS,
      termsAccepted: true,
    });
    expect(plan).toMatchObject({ ok: false, message: "Quote has expired" });
  });

  it("requires contact details", () => {
    const { customerPhone: _omit, ...rest } = CUSTOMER_DETAILS;
    void _omit;
    const plan = accept(quote("quoted"), "customer", { ...rest, termsAccepted: true });
    expect(plan).toMatchObject({ ok: false, code: "guard_failed" });
  });

  it("requires payout details unless Mode B", () => {
    const { paymentMethod: _pm, payIdPhone: _pp, ...contact } = CUSTOMER_DETAILS;
    void _pm;
    void _pp;
    expect(accept(quote("quoted"), "apiKey", contact).ok).toBe(false);
    expect(
      accept(quote("quoted", { partnerMode: "B" }), "apiKey", contact).ok
    ).toBe(true);
  });

  it("validates the payment method and its details", () => {
    const base = { ...CUSTOMER_DETAILS, termsAccepted: true };
    expect(
      accept(quote("quoted"), "customer", { ...base, paymentMethod: "cash" })
    ).toMatchObject({ ok: false, message: "paymentMethod must be 'payid' or 'bank_transfer'" });
    expect(
      accept(quote("quoted"), "customer", { ...base, payIdPhone: "" })
    ).toMatchObject({ ok: false, message: "payIdPhone is required for PayID payment method" });
    expect(
      accept(quote("quoted"), "customer", {
        ...base,
        paymentMethod: "bank_transfer",
        bankBSB: "062-000",
      })
    ).toMatchObject({ ok: false, code: "guard_failed" });
  });

  it("requires terms consent from customers and records it", () => {
    expect(
      accept(quote("quoted"), "customer", CUSTOMER_DETAILS)
    ).toMatchObject({ ok: false, message: "You must accept the Trade-In Terms & Conditions" });

    const plan = accept(quote("quoted"), "customer", {
      ...CUSTOMER_DETAILS,
      termsAccepted: true,
    });
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.termsVersion).toBe(TRADEIN_TERMS_VERSION);
    expect(plan.update.termsAcceptedAt).toEqual(NOW);
  });

  it("doesn't ask apiKey or admin for terms consent (Mode A/B review)", () => {
    const plan = accept(quote("quoted"), "apiKey", CUSTOMER_DETAILS);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.update.termsVersion).toBeUndefined();
  });

  it("lets admins accept with details already on the quote", () => {
    const plan = accept(quote("quoted", CUSTOMER_DETAILS), "admin", {});
    expect(plan.ok).toBe(true);
  });

  it("sets the IMEI only if valid and not already on the quote", () => {
    const payload = { ...CUSTOMER_DETAILS, termsAccepted: true };
    const withImei = accept(quote("quoted"), "customer", {
      ...payload,
      imei: "356789012345678",
    });
    const badImei = accept(quote("quoted"), "customer", { ...payload, imei: "123" });
    const existing = accept(quote("quoted", { imei: "111111111111111" }), "customer", {
      ...payload,
      imei: "356789012345678",
    });
    expect(withImei.ok && withImei.update.imei).toBe("356789012345678");
    expect(badImei.ok && badImei.update.imei).toBeUndefined();
    expect(existing.ok && existing.update.imei).toBeUndefined();
  });

  it("assigns a reference, links the customer and emails only non-admin accepts", () => {
    const customer = accept(quote("quoted"), "customer", {
      ...CUSTOMER_DETAILS,
      termsAccepted: true,
    });
    const admin = accept(quote("quoted", CUSTOMER_DETAILS), "admin", {});
    if (!customer.ok || !admin.ok) throw new Error("expected ok");
    expect(customer.assignReference).toBe(true);
    expect(customer.effects).toEqual(["link_customer", "accepted_email"]);
    expect(admin.effects).toEqual(["link_customer"]);
  });

  it("doesn't assign a second reference", () => {
    const plan = accept(quote("quoted", { tradeInRef: "TI-1001" }), "customer", {
      ...CUSTOMER_DETAILS,
      termsAccepted: true,
    });
    expect(plan.ok && plan.assignReference).toBe(false);
  });
});

describe("expiry", () => {
  it("quoted → expired only after expiresAt", () => {
    expect(planTransition(quote("quoted"), "expired", ctx("system")).ok).toBe(false);
    expect(
      planTransition(quote("quoted", { expiresAt: past() }), "expired", ctx("system")).ok
    ).toBe(true);
  });

  it("accepted → expired needs a label and postByAt + 30 days", () => {
    const expire = (extra: QuoteData) =>
      planTransition(quote("accepted", extra), "expired", ctx("system")).ok;
    expect(expire({})).toBe(false);
    expect(expire({ labelSentAt: past(20), postByAt: past(6) })).toBe(false);
    expect(expire({ labelSentAt: past(45), postByAt: past(31) })).toBe(true);
  });

  it("dueSystemTransition finds the deadline that has passed, if any", () => {
    const due = (status: QuoteStatus, extra: QuoteData = {}) =>
      dueSystemTransition(quote(status, extra), NOW);
    expect(due("quoted", { expiresAt: future() })).toBeNull();
    expect(due("quoted", { expiresAt: past() })).toBe("expired");
    expect(due("accepted", { expiresAt: past(10) })).toBeNull();
    expect(due("accepted", { labelSentAt: past(20), postByAt: past(6) })).toBeNull();
    expect(due("accepted", { labelSentAt: past(45), postByAt: past(31) })).toBe("expired");
    expect(due("revised", { revisionExpiresAt: future() })).toBeNull();
    expect(due("revised", { revisionExpiresAt: past() })).toBe("returning");
    expect(due("shipped", { expiresAt: past(), postByAt: past(60) })).toBeNull();
    expect(due("received", { expiresAt: past() })).toBeNull();
  });

  it("an unposted accepted quote expires with a closing email", () => {
    const plan = planTransition(
      quote("accepted", { labelSentAt: past(45), postByAt: past(31) }),
      "expired",
      ctx("system")
    );
    expect(plan.ok && plan.effects).toEqual(["expired_email"]);
  });

  it("the revision window defaults to 7 days (D3)", () => {
    expect(DEFAULT_REVISION_RESPONSE_DAYS).toBe(7);
    const plan = planTransition(
      quote("received"),
      "revised",
      ctx("admin", { payload: { inspectionGrade: "C", revisedPriceNZD: 100 } })
    );
    expect(plan.ok && plan.update.revisionExpiresAt).toEqual(
      new Date(NOW.getTime() + 7 * DAY)
    );
  });
});

describe("accepted → shipped", () => {
  it("customers need a label first; admins don't", () => {
    expect(planTransition(quote("accepted"), "shipped", ctx("customer"))).toMatchObject({
      ok: false,
      message: "Your shipping label hasn't been sent yet",
    });
    expect(
      planTransition(quote("accepted", { labelSentAt: past() }), "shipped", ctx("customer")).ok
    ).toBe(true);
    expect(planTransition(quote("accepted"), "shipped", ctx("admin")).ok).toBe(true);
  });
});

describe("receiving", () => {
  const receive = (q: QuoteData, payload: Record<string, unknown>) =>
    planTransition(q, "received", ctx("admin", { payload }));

  it("requires an IMEI or serial number", () => {
    expect(receive(quote("shipped"), {})).toMatchObject({ ok: false, code: "guard_failed" });
    expect(receive(quote("shipped"), { imei: "12345" })).toMatchObject({
      ok: false,
      message: "IMEI must be 15 digits",
    });
    expect(receive(quote("shipped"), { serialNumber: "F2LXK1ABCD" }).ok).toBe(true);
  });

  it("records the IMEI without overwriting the quoted one", () => {
    const plan = receive(quote("shipped", { imei: "111111111111111" }), {
      imei: "356789012345678",
    });
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.receivedImei).toBe("356789012345678");
    expect(plan.update.imei).toBeUndefined();
  });

  it("flags late arrivals", () => {
    const late = receive(quote("shipped", { expectedByAt: past() }), { imei: "356789012345678" });
    const onTime = receive(quote("shipped", { expectedByAt: future() }), {
      imei: "356789012345678",
    });
    expect(late.ok && late.update.lateArrival).toBe(true);
    expect(onTime.ok && onTime.update.lateArrival).toBeUndefined();
  });

  it("expired → received only if the quote had been accepted, and is always late", () => {
    expect(receive(quote("expired"), { imei: "356789012345678" })).toMatchObject({
      ok: false,
      code: "guard_failed",
    });
    const plan = receive(quote("expired", { acceptedAt: past(50) }), {
      imei: "356789012345678",
    });
    expect(plan.ok && plan.update.lateArrival).toBe(true);
  });
});

describe("late arrivals (D2)", () => {
  const late = quote("received", { lateArrival: true });
  const inspect = (q: QuoteData, to: "inspected" | "revised", payload: Record<string, unknown>) =>
    planTransition(q, to, ctx("admin", { payload }));

  it("can't be inspected or revised without a decision", () => {
    expect(inspect(late, "inspected", { inspectionGrade: "A" })).toMatchObject({
      ok: false,
      code: "guard_failed",
    });
    expect(
      inspect(late, "revised", { inspectionGrade: "C", revisedPriceNZD: 150, lateDecision: "maybe" }).ok
    ).toBe(false);
  });

  it("stores the decision and note with the inspection", () => {
    const plan = inspect(late, "inspected", {
      inspectionGrade: "A",
      lateDecision: "on_time",
      lateDecisionNote: " First scan 14 Oct ",
    });
    expect(plan.ok && plan.update).toMatchObject({
      lateDecision: "on_time",
      lateDecisionNote: "First scan 14 Oct",
    });
    const revised = inspect(late, "revised", {
      inspectionGrade: "C",
      revisedPriceNZD: 150,
      lateDecision: "reassess",
    });
    expect(revised.ok && revised.update.lateDecision).toBe("reassess");
  });

  it("isn't asked for on time arrivals, or twice", () => {
    const onTime = inspect(quote("received"), "inspected", {
      inspectionGrade: "A",
      lateDecision: "honour",
    });
    expect(onTime.ok && onTime.update.lateDecision).toBeUndefined();
    const decided = inspect(quote("received", { lateArrival: true, lateDecision: "honour" }), "inspected", {
      inspectionGrade: "A",
    });
    expect(decided.ok && decided.update.lateDecision).toBeUndefined();
  });
});

describe("cancellation", () => {
  const cancel = (q: QuoteData, cancelReason?: string, reason?: string) =>
    planTransition(q, "cancelled", ctx("admin", { payload: { cancelReason }, reason }));

  it("requires a reason code", () => {
    expect(cancel(quote("quoted")).ok).toBe(false);
    expect(cancel(quote("quoted"), "because").ok).toBe(false);
  });

  it("requires a note for 'other'", () => {
    expect(cancel(quote("quoted"), "other").ok).toBe(false);
    const plan = cancel(quote("quoted"), "other", "Spam");
    expect(plan.ok && plan.update).toMatchObject({ cancelReason: "other", cancelNote: "Spam" });
  });

  it("'surrendered' is only for quotes on hold, and the only reason there", () => {
    expect(cancel(quote("accepted"), "surrendered").ok).toBe(false);
    expect(cancel(quote("on_hold"), "customer_request").ok).toBe(false);
    expect(cancel(quote("on_hold"), "surrendered").ok).toBe(true);
  });
});

describe("unused labels", () => {
  it("go to the refund queue when an accepted quote is cancelled or expires", () => {
    const withLabel = { labelId: "label1", labelSentAt: past(45), postByAt: past(31) };
    const cancelled = planTransition(
      quote("accepted", withLabel),
      "cancelled",
      ctx("admin", { payload: { cancelReason: "customer_request" } })
    );
    const expired = planTransition(quote("accepted", withLabel), "expired", ctx("system"));
    expect(cancelled.ok && cancelled.effects).toEqual(["queue_label_refund"]);
    expect(expired.ok && expired.effects).toEqual([
      "expired_email",
      "queue_label_refund",
    ]);
  });

  it("aren't queued without a label, or once the parcel has shipped", () => {
    const noLabel = planTransition(
      quote("accepted"),
      "cancelled",
      ctx("admin", { payload: { cancelReason: "not_genuine" } })
    );
    const shipped = planTransition(
      quote("shipped", { labelId: "label1" }),
      "cancelled",
      ctx("admin", { payload: { cancelReason: "lost_in_transit" } })
    );
    expect(noLabel.ok && noLabel.effects).toEqual([]);
    expect(shipped.ok && shipped.effects).toEqual([]);
  });
});

describe("on hold", () => {
  it("requires a reason and stores where it was held from", () => {
    expect(planTransition(quote("inspected"), "on_hold", ctx("admin")).ok).toBe(false);
    const plan = planTransition(
      quote("inspected"),
      "on_hold",
      ctx("admin", { reason: "Blacklist check" })
    );
    expect(plan.ok && plan.update).toMatchObject({
      heldFrom: "inspected",
      holdReason: "Blacklist check",
    });
  });

  it("releases only to the held-from status, with a note", () => {
    const held = quote("on_hold", { heldFrom: "received" });
    expect(planTransition(held, "inspected", ctx("admin", { reason: "ok" }))).toMatchObject({
      ok: false,
      code: "guard_failed",
    });
    expect(planTransition(held, "received", ctx("admin")).ok).toBe(false);
    expect(planTransition(held, "received", ctx("admin", { reason: "ok" })).ok).toBe(true);
  });

  it("blocks payment while on hold", () => {
    expect(
      planTransition(quote("on_hold", { heldFrom: "inspected", ...CUSTOMER_DETAILS }), "paid", ctx("admin")).ok
    ).toBe(false);
  });
});

describe("inspection (D12)", () => {
  const inspect = (to: "inspected" | "revised", payload: Record<string, unknown>) =>
    planTransition(quote("received"), to, ctx("admin", { payload, revisionExpiryDays: 7 }));

  it("requires a grade", () => {
    expect(inspect("inspected", {}).ok).toBe(false);
    expect(inspect("revised", { revisedPriceNZD: 100 }).ok).toBe(false);
  });

  it("an inspection at the original quote can't carry a revised price", () => {
    expect(inspect("inspected", { inspectionGrade: "B", revisedPriceNZD: 150 }).ok).toBe(false);
    const plan = inspect("inspected", { inspectionGrade: "a" });
    expect(plan.ok && plan.update.inspectionGrade).toBe("A");
  });

  it("revisions only go down", () => {
    expect(inspect("revised", { inspectionGrade: "C" }).ok).toBe(false);
    expect(inspect("revised", { inspectionGrade: "C", revisedPriceNZD: 200 }).ok).toBe(false);
    expect(inspect("revised", { inspectionGrade: "C", revisedPriceNZD: 250 }).ok).toBe(false);
    expect(inspect("revised", { inspectionGrade: "C", revisedPriceNZD: -1 }).ok).toBe(false);
  });

  it("a revision sets the response deadline and emails the customer", () => {
    const plan = inspect("revised", { inspectionGrade: "C", revisedPriceNZD: "149.999" });
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.revisedPriceNZD).toBe(150);
    expect(plan.update.revisionExpiresAt).toEqual(new Date(NOW.getTime() + 7 * DAY));
    expect(plan.effects).toEqual(["revised_email"]);
  });

  it("stores the revised price in the customer's currency at the locked rate (D6)", () => {
    const aud = { displayCurrency: "AUD", fxRate: 0.92, quotePriceDisplay: 180 };
    const plan = planTransition(
      quote("received", aud),
      "revised",
      ctx("admin", { payload: { inspectionGrade: "C", revisedPriceNZD: 150 } })
    );
    expect(plan.ok && plan.update).toMatchObject({
      revisedPriceNZD: 150,
      revisedPriceDisplay: 135,
    });

    const nzd = planTransition(
      quote("received", { displayCurrency: "NZD", fxRate: 1, quotePriceDisplay: 200 }),
      "revised",
      ctx("admin", { payload: { inspectionGrade: "C", revisedPriceNZD: 199.5 } })
    );
    expect(nzd.ok && nzd.update.revisedPriceDisplay).toBe(199.5);
  });

  it("revisions must also go down in the customer's currency", () => {
    // 199 NZD × 0.92 = 183.08 → $180, the same as the original $180
    const aud = { displayCurrency: "AUD", fxRate: 0.92, quotePriceDisplay: 180 };
    const plan = planTransition(
      quote("received", aud),
      "revised",
      ctx("admin", { payload: { inspectionGrade: "C", revisedPriceNZD: 199 } })
    );
    expect(plan).toMatchObject({ ok: false, code: "guard_failed" });
    expect(!plan.ok && plan.message).toContain("$180.00 AUD");
  });

  it("revised device fields must be complete", () => {
    expect(
      inspect("inspected", { inspectionGrade: "A", revisedDeviceId: "d1" }).ok
    ).toBe(false);
    const plan = inspect("inspected", {
      inspectionGrade: "A",
      revisedDeviceId: "d1",
      revisedDeviceMake: "Apple",
      revisedDeviceModel: "iPhone 15",
      revisedDeviceStorage: "256GB",
    });
    expect(plan.ok && plan.update.revisedDeviceModel).toBe("iPhone 15");
  });
});

describe("revision responses", () => {
  const revised = (expires: Date) => quote("revised", { revisionExpiresAt: expires });

  it("customers, partners and API keys can respond only before the deadline", () => {
    for (const actor of ["customer", "partner", "apiKey"] as const) {
      expect(planTransition(revised(future()), "inspected", ctx(actor)).ok).toBe(true);
      expect(planTransition(revised(future()), "returning", ctx(actor)).ok).toBe(true);
      expect(planTransition(revised(past()), "inspected", ctx(actor))).toMatchObject({
        ok: false,
        message: "Revision response period has expired",
      });
      expect(planTransition(revised(past()), "returning", ctx(actor)).ok).toBe(false);
    }
  });

  it("records acceptance and rejection", () => {
    const accepted = planTransition(revised(future()), "inspected", ctx("customer"));
    const rejected = planTransition(revised(future()), "returning", ctx("customer"));
    expect(accepted.ok && accepted.update.revisionAcceptedAt).toEqual(NOW);
    expect(rejected.ok && rejected.update.revisionRejectedAt).toEqual(NOW);
  });

  it("admins can force-accept after the deadline, with a reason", () => {
    expect(planTransition(revised(past()), "inspected", ctx("admin")).ok).toBe(false);
    const plan = planTransition(
      revised(past()),
      "inspected",
      ctx("admin", { reason: "Customer agreed by phone" })
    );
    expect(plan.ok && plan.update.revisionForceAccepted).toBe(true);
  });

  it("the system returns the device only after the deadline", () => {
    expect(planTransition(revised(future()), "returning", ctx("system")).ok).toBe(false);
    const plan = planTransition(revised(past()), "returning", ctx("system"));
    expect(plan.ok && plan.update.revisionAutoExpired).toBe(true);
  });
});

describe("inspected → paid", () => {
  it("requires payout details unless Mode B", () => {
    expect(planTransition(quote("inspected"), "paid", ctx("admin"))).toMatchObject({
      ok: false,
      message: "Payout details are missing",
    });
    expect(
      planTransition(quote("inspected", { partnerMode: "B" }), "paid", ctx("admin")).ok
    ).toBe(true);
    expect(
      planTransition(
        quote("inspected", {
          paymentMethod: "bank_transfer",
          bankBSB: "062-000",
          bankAccountNumber: "12345678",
          bankAccountName: "Sam Seller",
        }),
        "paid",
        ctx("admin")
      ).ok
    ).toBe(true);
  });

  it("triggers commission and the paid email", () => {
    const plan = planTransition(quote("inspected", CUSTOMER_DETAILS), "paid", ctx("admin"));
    expect(plan.ok && plan.effects).toEqual(["commission", "paid_email"]);
  });

  it("saves a payout snapshot of the amount payable", () => {
    const plan = planTransition(
      quote("inspected", {
        ...CUSTOMER_DETAILS,
        displayCurrency: "AUD",
        fxRate: 0.92,
        quotePriceDisplay: 180,
        revisedPriceNZD: 150,
        revisedPriceDisplay: 135,
      }),
      "paid",
      ctx("admin", { actorId: "admin@rhex.app" })
    );
    expect(plan.ok && plan.update.payout).toEqual({
      method: "payid",
      payIdPhone: "•••• 123",
      bankBSB: null,
      bankAccountNumber: null,
      bankAccountName: null,
      amount: 135,
      currency: "AUD",
      amountNZD: 150,
      paidAt: NOW,
      paidBy: "admin@rhex.app",
    });
  });
});

describe("admin returns", () => {
  it("require a reason", () => {
    for (const from of ["received", "inspected", "on_hold"] as const) {
      expect(planTransition(quote(from), "returning", ctx("admin")).ok).toBe(false);
      const plan = planTransition(quote(from), "returning", ctx("admin", { reason: "Rejected (§14)" }));
      expect(plan.ok && plan.update.returnReason).toBe("Rejected (§14)");
    }
  });
});

// ---------------------------------------------------------------------------
// allowedTransitions
// ---------------------------------------------------------------------------

describe("allowedTransitions", () => {
  it("lists the admin's moves from received", () => {
    expect(allowedTransitions(quote("received"), "admin", NOW).sort()).toEqual(
      ["inspected", "on_hold", "returning", "revised"].sort()
    );
  });

  it("applies state guards", () => {
    expect(allowedTransitions(quote("quoted"), "customer", NOW)).toEqual(["accepted"]);
    expect(
      allowedTransitions(quote("quoted", { expiresAt: past() }), "customer", NOW)
    ).toEqual([]);
    expect(
      allowedTransitions(quote("on_hold", { heldFrom: "received" }), "admin", NOW).sort()
    ).toEqual(["cancelled", "received", "returning"]);
    expect(allowedTransitions(quote("expired"), "admin", NOW)).toEqual([]);
    expect(
      allowedTransitions(quote("expired", { acceptedAt: past() }), "admin", NOW)
    ).toEqual(["received"]);
  });

  it("has nothing for terminal statuses", () => {
    for (const status of ["paid", "returned", "cancelled"] as const) {
      for (const actor of ACTORS) {
        expect(allowedTransitions(quote(status), actor, NOW)).toEqual([]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Customer totals
// ---------------------------------------------------------------------------

describe("customer totalValueNZD", () => {
  const linked = { customerId: "c1", acceptedAt: past(5) };

  it("is reversed when a linked quote ends unpaid", () => {
    const cases: [QuoteData, QuoteStatus, TransitionContext][] = [
      [
        quote("accepted", linked),
        "cancelled",
        ctx("admin", { payload: { cancelReason: "customer_request" } }),
      ],
      [
        quote("shipped", linked),
        "cancelled",
        ctx("admin", { payload: { cancelReason: "lost_in_transit" } }),
      ],
      [
        quote("on_hold", { ...linked, heldFrom: "received" }),
        "cancelled",
        ctx("admin", { payload: { cancelReason: "surrendered" } }),
      ],
      [
        quote("accepted", { ...linked, labelSentAt: past(45), postByAt: past(31) }),
        "expired",
        ctx("system"),
      ],
      [quote("returning", linked), "returned", ctx("admin")],
    ];
    for (const [q, to, c] of cases) {
      const plan = planTransition(q, to, c);
      if (!plan.ok) throw new Error(plan.message);
      expect(plan.effects).toContain("reverse_customer_value");
    }
  });

  it("is restored when an expired quote is received after all", () => {
    const plan = planTransition(
      quote("expired", linked),
      "received",
      ctx("admin", { payload: { imei: "356789012345678" } })
    );
    expect(plan.ok && plan.effects).toEqual(["restore_customer_value"]);
  });

  it("is untouched for quotes with no linked customer", () => {
    const plan = planTransition(quote("returning"), "returned", ctx("admin"));
    expect(plan.ok && plan.effects).toEqual(["returned_email"]);
    const paid = planTransition(
      quote("inspected", { ...linked, ...CUSTOMER_DETAILS }),
      "paid",
      ctx("admin")
    );
    expect(paid.ok && paid.effects).not.toContain("reverse_customer_value");
  });
});

describe("returning → returned", () => {
  it("emails the customer, with the return tracking number if given", () => {
    const plan = planTransition(
      quote("returning"),
      "returned",
      ctx("admin", { payload: { returnTrackingNumber: " 33ab 1234 " } })
    );
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.returnTrackingNumber).toBe("33AB1234");
    expect(plan.effects).toContain("returned_email");
  });

  it("doesn't need a tracking number", () => {
    const plan = planTransition(quote("returning"), "returned", ctx("admin"));
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.returnTrackingNumber).toBeNull();
  });
});

describe("acceptance address", () => {
  const { shippingAddress: _line, shippingAddressParts: _parts, ...contact } = CUSTOMER_DETAILS;
  const accept = (actor: "customer" | "admin" | "apiKey", payload: Record<string, unknown>) =>
    planTransition(
      quote("quoted"),
      "accepted",
      ctx(actor, { payload: { ...contact, termsAccepted: true, ...payload } })
    );

  it("stores the parts and the one-line address", () => {
    const plan = accept("customer", {
      shippingAddressParts: {
        line1: " 12  Smith St ",
        line2: "Unit 2",
        suburb: "Sydney",
        state: "nsw",
        postcode: "2000",
      },
    });
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.update.shippingAddressParts).toEqual({
      line1: "12 Smith St",
      line2: "Unit 2",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
    });
    expect(plan.update.shippingAddress).toBe("12 Smith St, Unit 2, Sydney NSW 2000");
  });

  it("rejects incomplete addresses", () => {
    const base = { line1: "12 Smith St", suburb: "Sydney", state: "NSW", postcode: "2000" };
    for (const [change, message] of [
      [{ suburb: "" }, "Enter your suburb"],
      [{ state: "XX" }, "Choose your state"],
      [{ postcode: "200" }, "Enter a 4-digit postcode"],
    ] as const) {
      const plan = accept("customer", { shippingAddressParts: { ...base, ...change } });
      expect(plan.ok ? null : plan.message).toBe(message);
    }
  });

  it("requires the parts from customers but not from the v1 API", () => {
    const customer = accept("customer", { shippingAddress: "1 Test St, Sydney NSW 2000" });
    expect(customer.ok ? null : customer.message).toBe("Enter your shipping address");
    const api = accept("apiKey", { shippingAddress: "1 Test St, Sydney NSW 2000" });
    if (!api.ok) throw new Error(api.message);
    expect(api.update.shippingAddress).toBe("1 Test St, Sydney NSW 2000");
    expect(api.update.shippingAddressParts).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Partner modes (docs/PARTNERSHIP.md, docs/partners/OPPO.md)
// ---------------------------------------------------------------------------

function planOk(q: QuoteData, to: QuoteStatus, c: TransitionContext) {
  const plan = planTransition(q, to, c);
  if (!plan.ok) throw new Error(`expected ok, got ${plan.code}: ${plan.message}`);
  return plan;
}

describe("Mode B (RHEX deals only with the partner)", () => {
  const modeB = (status: QuoteStatus, extra: QuoteData = {}) =>
    quote(status, { partnerMode: "B", partnerId: "p1", ...extra });

  it("accepts with no customer contact, and sends nothing to the customer", () => {
    const plan = planOk(modeB("quoted"), "accepted", ctx("apiKey", { payload: {} }));
    expect(plan.update.customerName).toBeUndefined();
    expect(plan.effects).toEqual([]);
  });

  it("keeps customer contact given as reference", () => {
    const plan = planOk(
      modeB("quoted"),
      "accepted",
      ctx("apiKey", { payload: { customerName: "Sam", customerEmail: "sam@example.com" } })
    );
    expect(plan.update.customerName).toBe("Sam");
    expect(plan.effects).toEqual([]);
  });

  it("refuses payment details", () => {
    for (const field of ["paymentMethod", "payIdPhone", "bankBSB", "bankAccountNumber", "bankAccountName"]) {
      const plan = planTransition(
        modeB("quoted"),
        "accepted",
        ctx("apiKey", { payload: { [field]: "x" } })
      );
      expect(plan.ok, field).toBe(false);
    }
  });

  it("drops every customer email and customer-record effect", () => {
    const revised = planOk(
      modeB("received", CUSTOMER_DETAILS),
      "revised",
      ctx("admin", { payload: { inspectionGrade: "C", revisedPriceNZD: 100 } })
    );
    expect(revised.effects).toEqual([]);

    const paid = planOk(modeB("inspected", CUSTOMER_DETAILS), "paid", ctx("admin"));
    expect(paid.effects).toEqual(["commission"]);

    const returned = planOk(
      modeB("returning", { ...CUSTOMER_DETAILS, customerId: "c1" }),
      "returned",
      ctx("admin")
    );
    expect(returned.effects).toEqual([]);

    const expired = planOk(
      modeB("accepted", { ...CUSTOMER_DETAILS, labelSentAt: past(50), postByAt: past(40) }),
      "expired",
      ctx("system")
    );
    expect(expired.effects).toEqual([]);
  });

  it("never queues a partner result", () => {
    const plan = planOk(modeB("inspected"), "paid", ctx("admin"));
    expect(plan.partnerResult).toBeNull();
  });
});

describe("Mode C (RHEX buys; the partner refunds the customer)", () => {
  // AUD quote locked at 0.9: 200 NZD → 180 AUD
  const modeC = (status: QuoteStatus, extra: QuoteData = {}) =>
    quote(status, {
      partnerMode: "C",
      partnerId: "oppo",
      displayCurrency: "AUD",
      fxRate: 0.9,
      quotePriceDisplay: 180,
      grade: "B",
      ...extra,
    });

  const ACCEPT = {
    customerFirstName: "Sam",
    customerLastName: "Seller",
    customerEmail: "sam@example.com",
    customerPhone: "0400000000",
    shippingAddress: { line1: "1 Test St", line2: "Unit 2", suburb: "Sydney", state: "nsw", postcode: "2000" },
    termsAccepted: true,
    termsVersion: TRADEIN_TERMS_VERSION,
  };

  const accept = (payload: Record<string, unknown>, actor: QuoteActor = "apiKey") =>
    planTransition(modeC("quoted"), "accepted", ctx(actor, { payload }));

  describe("acceptance", () => {
    it("stores contact, address and consent, and emails the customer", () => {
      const plan = accept(ACCEPT);
      if (!plan.ok) throw new Error(plan.message);
      expect(plan.update).toMatchObject({
        customerFirstName: "Sam",
        customerLastName: "Seller",
        customerName: "Sam Seller",
        customerEmail: "sam@example.com",
        customerPhone: "0400000000",
        shippingAddressParts: { line1: "1 Test St", line2: "Unit 2", suburb: "Sydney", state: "NSW", postcode: "2000" },
        termsVersion: TRADEIN_TERMS_VERSION,
        termsAcceptedAt: NOW,
        marketingConsent: false,
        marketingConsentAt: null,
      });
      expect(plan.update.paymentMethod).toBeUndefined();
      expect(plan.effects).toEqual(["link_customer", "accepted_email"]);
      expect(plan.assignReference).toBe(true);
      expect(plan.partnerResult).toBeNull();
    });

    it("records marketing consent only when given", () => {
      const plan = accept({ ...ACCEPT, marketingConsent: true });
      if (!plan.ok) throw new Error(plan.message);
      expect(plan.update.marketingConsent).toBe(true);
      expect(plan.update.marketingConsentAt).toEqual(NOW);
      expect(accept({ ...ACCEPT, marketingConsent: "yes" }).ok).toBe(false);
    });

    it.each([
      "customerFirstName",
      "customerLastName",
      "customerEmail",
      "customerPhone",
      "shippingAddress",
    ])("requires %s", (field) => {
      const payload: Record<string, unknown> = { ...ACCEPT };
      delete payload[field];
      expect(accept(payload).ok).toBe(false);
    });

    it("validates the email and the AU address", () => {
      expect(accept({ ...ACCEPT, customerEmail: "not-an-email" }).ok).toBe(false);
      expect(
        accept({ ...ACCEPT, shippingAddress: { line1: "1 Test St", suburb: "Sydney", state: "XX", postcode: "2000" } }).ok
      ).toBe(false);
      // A one-line address isn't enough
      expect(accept({ ...ACCEPT, shippingAddress: "1 Test St, Sydney NSW 2000" }).ok).toBe(false);
    });

    it("requires consent to the current terms", () => {
      expect(accept({ ...ACCEPT, termsAccepted: false }).ok).toBe(false);
      expect(accept({ ...ACCEPT, termsAccepted: undefined }).ok).toBe(false);
      const old = accept({ ...ACCEPT, termsVersion: "2026-10-02" });
      expect(old.ok).toBe(false);
      if (!old.ok) expect(old.message).toContain(TRADEIN_TERMS_VERSION);
    });

    it("refuses payment details", () => {
      expect(accept({ ...ACCEPT, paymentMethod: "payid", payIdPhone: "0400000123" }).ok).toBe(false);
      expect(accept({ ...ACCEPT, bankAccountNumber: "123456" }).ok).toBe(false);
    });

    it("can't be accepted by the customer on the public page", () => {
      const plan = accept(ACCEPT, "customer");
      expect(plan.ok).toBe(false);
      if (!plan.ok) expect(plan.code).toBe("forbidden");
      expect(allowedTransitions(modeC("quoted"), "customer", NOW)).not.toContain("accepted");
    });

    it("lets an admin accept with details already on the quote, without consent", () => {
      const q = modeC("quoted", {
        customerFirstName: "Sam",
        customerLastName: "Seller",
        customerEmail: "sam@example.com",
        customerPhone: "0400000000",
        shippingAddressParts: ACCEPT.shippingAddress,
      });
      const plan = planOk(q, "accepted", ctx("admin", { payload: {} }));
      expect(plan.update.termsVersion).toBeUndefined();
      expect(plan.effects).toEqual(["link_customer"]);
    });
  });

  describe("revised offers", () => {
    const revised = (extra: QuoteData = {}) =>
      modeC("revised", {
        inspectionGrade: "D",
        revisedPriceNZD: 100,
        revisedPriceDisplay: 90,
        revisionExpiresAt: future(3),
        ...extra,
      });

    it("are answered by the customer, not the partner", () => {
      for (const actor of ["apiKey", "partner"] as const) {
        for (const to of ["inspected", "returning"] as const) {
          const plan = planTransition(revised(), to, ctx(actor));
          expect(plan.ok).toBe(false);
          if (!plan.ok) expect(plan.code).toBe("forbidden");
        }
      }
      expect(planTransition(revised(), "inspected", ctx("customer")).ok).toBe(true);
      expect(allowedTransitions(revised(), "apiKey", NOW)).toEqual([]);
    });

    it("declined → result not accepted, revised price and grade", () => {
      const plan = planOk(revised(), "returning", ctx("customer"));
      expect(plan.partnerResult).toEqual({ approvedQuotePrice: 90, acceptGrading: "D", accepted: false });
      expect(plan.effects).toContain("partner_result");
    });

    it("expired → result not accepted", () => {
      const plan = planOk(revised({ revisionExpiresAt: past() }), "returning", ctx("system"));
      expect(plan.partnerResult).toEqual({ approvedQuotePrice: 90, acceptGrading: "D", accepted: false });
    });

    it("accepted → no result until approved", () => {
      const plan = planOk(revised(), "inspected", ctx("customer"));
      expect(plan.partnerResult).toBeNull();
    });
  });

  describe("approval (inspected → paid)", () => {
    it("needs no payout details and saves a settlement, not a payout", () => {
      const plan = planOk(modeC("inspected", { inspectionGrade: "A" }), "paid", ctx("admin", { actorId: "ops@reflowhub.com" }));
      expect(plan.update.payout).toBeUndefined();
      expect(plan.update.settlement).toEqual({
        partnerId: "oppo",
        amount: 180,
        currency: "AUD",
        amountNZD: 200,
        approvedAt: NOW,
        approvedBy: "ops@reflowhub.com",
      });
      // No commission; "Approved" replaces the "Payment sent" email
      expect(plan.effects).toEqual(["approved_email", "partner_result"]);
    });

    it("matched device → original AUD price and original grade", () => {
      // Inspected as better than declared: still the original quote (D12)
      const plan = planOk(modeC("inspected", { inspectionGrade: "A" }), "paid", ctx("admin"));
      expect(plan.partnerResult).toEqual({ approvedQuotePrice: 180, acceptGrading: "B", accepted: true });
    });

    it("accepted re-quote → revised AUD price and inspection grade", () => {
      const q = modeC("inspected", { inspectionGrade: "D", revisedPriceNZD: 100, revisedPriceDisplay: 90 });
      const plan = planOk(q, "paid", ctx("admin"));
      expect(plan.partnerResult).toEqual({ approvedQuotePrice: 90, acceptGrading: "D", accepted: true });
    });
  });

  describe("endings without a customer decision", () => {
    it("RHEX returns the device → not accepted, last offered price", () => {
      const plan = planOk(modeC("received"), "returning", ctx("admin", { reason: "iCloud locked" }));
      expect(plan.partnerResult).toEqual({ approvedQuotePrice: 180, acceptGrading: "B", accepted: false });
    });

    it("returned after inspection → inspection grade", () => {
      const plan = planOk(modeC("inspected", { inspectionGrade: "E" }), "returning", ctx("admin", { reason: "Not a device we buy" }));
      expect(plan.partnerResult).toEqual({ approvedQuotePrice: 180, acceptGrading: "E", accepted: false });
    });

    it("surrendered to authorities → not accepted", () => {
      const plan = planOk(
        modeC("on_hold", { heldFrom: "received" }),
        "cancelled",
        ctx("admin", { payload: { cancelReason: "surrendered" } })
      );
      expect(plan.partnerResult?.accepted).toBe(false);
    });

    it("sends nothing when the device never arrived", () => {
      const cancelled = planOk(modeC("accepted"), "cancelled", ctx("admin", { payload: { cancelReason: "customer_request" } }));
      expect(cancelled.partnerResult).toBeNull();
      const expired = planOk(
        modeC("accepted", { labelSentAt: past(50), postByAt: past(40) }),
        "expired",
        ctx("system")
      );
      expect(expired.partnerResult).toBeNull();
    });

    it("sends nothing once the device is back with the customer", () => {
      const plan = planOk(modeC("returning"), "returned", ctx("admin"));
      expect(plan.partnerResult).toBeNull();
    });
  });

  it("customer emails still go out (RHEX deals with the customer)", () => {
    const plan = planOk(
      modeC("received", CUSTOMER_DETAILS),
      "revised",
      ctx("admin", { payload: { inspectionGrade: "C", revisedPriceNZD: 100 } })
    );
    expect(plan.effects).toEqual(["revised_email"]);
  });

  describe("Mode C-only emails", () => {
    const receive = ctx("admin", { payload: { imei: "356789012345678" } });

    it("received: on arrival, including late, but not on release from hold", () => {
      expect(planOk(modeC("accepted"), "received", receive).effects).toEqual(["received_email"]);
      expect(planOk(modeC("shipped"), "received", receive).effects).toEqual(["received_email"]);
      expect(planOk(modeC("expired", { acceptedAt: past(60) }), "received", receive).effects).toContain("received_email");
      const released = planOk(modeC("on_hold", { heldFrom: "received" }), "received", ctx("admin", { reason: "Cleared" }));
      expect(released.effects).not.toContain("received_email");
    });

    it("returning: declined, expired or returned by RHEX", () => {
      const revised = modeC("revised", { inspectionGrade: "D", revisedPriceNZD: 100, revisionExpiresAt: future(3) });
      expect(planOk(revised, "returning", ctx("customer")).effects).toEqual(["returning_email", "partner_result"]);
      const lapsed = { ...revised, revisionExpiresAt: past() };
      expect(planOk(lapsed, "returning", ctx("system")).effects).toContain("returning_email");
      for (const from of ["received", "inspected"] as const) {
        expect(planOk(modeC(from), "returning", ctx("admin", { reason: "iCloud locked" })).effects).toContain("returning_email");
      }
      expect(
        planOk(modeC("on_hold", { heldFrom: "received" }), "returning", ctx("admin", { reason: "Locked" })).effects
      ).toContain("returning_email");
    });

    it("consumer quotes are unchanged", () => {
      expect(planOk(quote("accepted"), "received", receive).effects).toEqual([]);
      expect(planOk(quote("received"), "returning", ctx("admin", { reason: "Locked" })).effects).toEqual([]);
      const paid = planOk(quote("inspected", CUSTOMER_DETAILS), "paid", ctx("admin"));
      expect(paid.effects).toEqual(["commission", "paid_email"]);
    });
  });

  describe("re-quote reminder", () => {
    const HOUR = 60 * 60 * 1000;
    const revised = (hoursLeft: number, extra: QuoteData = {}) =>
      modeC("revised", {
        revisedAt: past(5),
        revisionExpiresAt: new Date(NOW.getTime() + hoursLeft * HOUR),
        ...extra,
      });

    it("is due within 48 hours of the deadline, once", () => {
      expect(dueRevisionReminder(revised(49), NOW)).toBe(false);
      expect(dueRevisionReminder(revised(48), NOW)).toBe(true);
      expect(dueRevisionReminder(revised(1), NOW)).toBe(true);
      expect(dueRevisionReminder(revised(-1), NOW)).toBe(false);
      expect(dueRevisionReminder(revised(10, { remindersSent: { revision: past() } }), NOW)).toBe(false);
      // Label reminders don't count
      expect(dueRevisionReminder(revised(10, { remindersSent: { day7: past(20) } }), NOW)).toBe(true);
    });

    it("waits a day after the offer when the response period is short", () => {
      expect(dueRevisionReminder(revised(40, { revisedAt: new Date(NOW.getTime() - 8 * HOUR) }), NOW)).toBe(false);
      expect(dueRevisionReminder(revised(20, { revisedAt: past(1) }), NOW)).toBe(true);
    });

    it("is Mode C only, and only while revised", () => {
      const consumer = quote("revised", { revisedAt: past(5), revisionExpiresAt: future(1) });
      expect(dueRevisionReminder(consumer, NOW)).toBe(false);
      expect(dueRevisionReminder({ ...revised(10), status: "returning" }, NOW)).toBe(false);
    });
  });
});
