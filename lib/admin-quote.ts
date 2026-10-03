import { adminDb } from "@/lib/firebase-admin";
import { serializeTimestamp } from "@/lib/serialize";
import {
  customerEmailSwitches,
  neverArrivedResultOn,
  quoteLabelArrangement,
} from "@/lib/partner-config";
import { allowedTransitions, type QuoteData } from "@/lib/quote-transitions";

// ---------------------------------------------------------------------------
// Admin quote detail response (GET/PUT /api/admin/quotes/[id] and label routes)
// ---------------------------------------------------------------------------

const TIMESTAMP_FIELDS = [
  "createdAt",
  "expiresAt",
  "acceptedAt",
  "termsAcceptedAt",
  "shippedAt",
  "receivedAt",
  "onHoldAt",
  "revisedAt",
  "revisionExpiresAt",
  "revisionAcceptedAt",
  "revisionRejectedAt",
  "inspectedAt",
  "paidAt",
  "returningAt",
  "returnedAt",
  "expiredAt",
  "cancelledAt",
  "labelSentAt",
  "postByAt",
  "expectedByAt",
] as const;

const PLAIN_FIELDS = [
  "deviceId",
  "grade",
  "quotePriceNZD",
  "quotePriceDisplay",
  "displayCurrency",
  "fxRate",
  "status",
  "tradeInRef",
  "termsVersion",
  "customerName",
  "customerFirstName",
  "customerLastName",
  "customerEmail",
  "customerPhone",
  "shippingAddress",
  "shippingAddressParts",
  "paymentMethod",
  "payIdPhone",
  "bankBSB",
  "bankAccountNumber",
  "bankAccountName",
  "customerId",
  "partnerMode",
  "imei",
  "receivedImei",
  "receivedSerial",
  "lateArrival",
  "lateDecision",
  "lateDecisionNote",
  "inspectionGrade",
  "revisedPriceNZD",
  "revisedPriceDisplay",
  "revisedDeviceId",
  "revisedDeviceMake",
  "revisedDeviceModel",
  "revisedDeviceStorage",
  "revisionAutoExpired",
  "revisionForceAccepted",
  "heldFrom",
  "holdReason",
  "releaseNote",
  "returnReason",
  "returnTrackingNumber",
  "cancelReason",
  "cancelNote",
  "platform",
  "geoCountry",
  "geoCity",
  "geoRegion",
  "labelId",
  "carrier",
  "trackingNumber",
  "labelCostAUD",
  "returnLabelId",
  "returnLabelCostAUD",
  "marketingConsent",
] as const;

export async function toAdminQuote(id: string, data: QuoteData) {
  let device: Record<string, unknown> | null = null;
  if (typeof data.deviceId === "string" && data.deviceId) {
    const deviceDoc = await adminDb.collection("devices").doc(data.deviceId).get();
    if (deviceDoc.exists) device = deviceDoc.data()!;
  }

  const partnerId = (data.partnerId as string) ?? null;
  let partnerName: string | null = null;
  // Mode C: what cancelling tells the partner and the customer (Cancel dialog)
  let partnerNeverArrivedResult = false;
  let partnerCancelledEmail = false;
  if (partnerId) {
    const partnerDoc = await adminDb.collection("partners").doc(partnerId).get();
    if (partnerDoc.exists) {
      const partner = partnerDoc.data();
      partnerName = (partner?.name as string) ?? null;
      if (data.partnerMode === "C") {
        partnerNeverArrivedResult = neverArrivedResultOn(partner);
        partnerCancelledEmail = customerEmailSwitches(partner).cancelled;
      }
    }
  }

  const quote: Record<string, unknown> = {
    id,
    device: {
      id: data.deviceId ?? "",
      make: (device?.make as string) ?? "",
      model: (device?.model as string) ?? "",
      storage: (device?.storage as string) ?? "",
    },
    partnerId,
    partnerName,
    partnerNeverArrivedResult,
    partnerCancelledEmail,
    sandbox: data.sandbox === true,
  };
  for (const field of PLAIN_FIELDS) quote[field] = data[field] ?? null;
  for (const field of TIMESTAMP_FIELDS) {
    quote[field] = serializeTimestamp(data[field]);
  }

  const history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  quote.statusHistory = history.map((entry: Record<string, unknown>) => ({
    ...entry,
    at: serializeTimestamp(entry.at),
  }));
  const payout = data.payout as Record<string, unknown> | undefined;
  quote.payout = payout
    ? { ...payout, paidAt: serializeTimestamp(payout.paidAt) }
    : null;
  const settlement = data.settlement as Record<string, unknown> | undefined;
  quote.settlement = settlement
    ? { ...settlement, approvedAt: serializeTimestamp(settlement.approvedAt) }
    : null;
  const partnerResult = data.partnerResult as Record<string, unknown> | undefined;
  quote.partnerResult = partnerResult
    ? {
        ...partnerResult,
        queuedAt: serializeTimestamp(partnerResult.queuedAt),
        updatedAt: serializeTimestamp(partnerResult.updatedAt),
      }
    : null;
  quote.allowedTransitions = allowedTransitions(data, "admin");

  // Who makes and pays for this trade-in's labels (OPPO.md, 2e); labels
  // from before these fields are Reflow's
  quote.labelArrangement = quoteLabelArrangement(data);
  quote.labelProvidedBy = data.labelId ? data.labelProvidedBy ?? "reflow" : null;
  quote.labelPaidBy = data.labelId ? data.labelPaidBy ?? "reflow" : null;
  quote.returnLabelProvidedBy = data.returnLabelId ? data.returnLabelProvidedBy ?? "reflow" : null;
  quote.returnLabelPaidBy = data.returnLabelId ? data.returnLabelPaidBy ?? "reflow" : null;

  return quote;
}
