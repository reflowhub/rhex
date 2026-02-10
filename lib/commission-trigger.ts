import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { calculateCommission, PartnerCommissionConfig } from "@/lib/commission";

/**
 * Called when a quote transitions to "paid" status.
 * Creates a commission ledger entry for Mode A referral partners.
 *
 * Mode B partners are NOT eligible for commission — they already get
 * the partner rate discount.
 */
export async function onQuotePaid(
  quoteId: string,
  quoteData: Record<string, unknown>
): Promise<void> {
  // Only Mode A referrals earn commission
  if (quoteData.partnerMode !== "A") return;

  const partnerId = quoteData.partnerId as string | undefined;
  if (!partnerId) return;

  // Check for duplicate — don't create commission twice
  const existing = await adminDb
    .collection("commissionLedger")
    .where("quoteId", "==", quoteId)
    .limit(1)
    .get();

  if (!existing.empty) return;

  // Fetch partner config
  const partnerDoc = await adminDb.collection("partners").doc(partnerId).get();
  if (!partnerDoc.exists) return;

  const partnerData = partnerDoc.data()!;
  if (partnerData.status !== "active") return;
  if (!partnerData.modes?.includes("A")) return;

  const config: PartnerCommissionConfig = {
    commissionModel: partnerData.commissionModel || "percentage",
    commissionPercent: partnerData.commissionPercent ?? 5,
    commissionFlat: partnerData.commissionFlat ?? 5,
    commissionTiers: partnerData.commissionTiers ?? null,
  };

  // Determine quote total and device count
  const quoteTotal = Number(quoteData.quotePriceNZD ?? 0);
  const deviceCount = 1; // single quote = 1 device

  // For tiered model, count this month's devices
  let monthlyDeviceCount = 0;
  if (config.commissionModel === "tiered") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySnapshot = await adminDb
      .collection("commissionLedger")
      .where("partnerId", "==", partnerId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
      .get();
    monthlyDeviceCount = monthlySnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data().deviceCount ?? 0),
      0
    );
  }

  const commissionAmount = calculateCommission(
    quoteTotal,
    deviceCount,
    config,
    monthlyDeviceCount + deviceCount
  );

  if (commissionAmount <= 0) return;

  await adminDb.collection("commissionLedger").add({
    partnerId,
    quoteId,
    bulkQuoteId: null,
    deviceCount,
    quoteTotal,
    commissionAmount,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: null,
    payoutId: null,
  });
}

/**
 * Called when a bulk quote transitions to "paid" status.
 * Creates a commission ledger entry for Mode A referral partners.
 */
export async function onBulkQuotePaid(
  bulkQuoteId: string,
  bulkQuoteData: Record<string, unknown>
): Promise<void> {
  if (bulkQuoteData.partnerMode !== "A") return;

  const partnerId = bulkQuoteData.partnerId as string | undefined;
  if (!partnerId) return;

  // Duplicate check
  const existing = await adminDb
    .collection("commissionLedger")
    .where("bulkQuoteId", "==", bulkQuoteId)
    .limit(1)
    .get();

  if (!existing.empty) return;

  // Fetch partner config
  const partnerDoc = await adminDb.collection("partners").doc(partnerId).get();
  if (!partnerDoc.exists) return;

  const partnerData = partnerDoc.data()!;
  if (partnerData.status !== "active") return;
  if (!partnerData.modes?.includes("A")) return;

  const config: PartnerCommissionConfig = {
    commissionModel: partnerData.commissionModel || "percentage",
    commissionPercent: partnerData.commissionPercent ?? 5,
    commissionFlat: partnerData.commissionFlat ?? 5,
    commissionTiers: partnerData.commissionTiers ?? null,
  };

  const quoteTotal = Number(bulkQuoteData.totalIndicativeNZD ?? 0);
  const deviceCount = Number(bulkQuoteData.totalDevices ?? 0);

  // For tiered model, count monthly devices
  let monthlyDeviceCount = 0;
  if (config.commissionModel === "tiered") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySnapshot = await adminDb
      .collection("commissionLedger")
      .where("partnerId", "==", partnerId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
      .get();
    monthlyDeviceCount = monthlySnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data().deviceCount ?? 0),
      0
    );
  }

  const commissionAmount = calculateCommission(
    quoteTotal,
    deviceCount,
    config,
    monthlyDeviceCount + deviceCount
  );

  if (commissionAmount <= 0) return;

  await adminDb.collection("commissionLedger").add({
    partnerId,
    quoteId: null,
    bulkQuoteId,
    deviceCount,
    quoteTotal,
    commissionAmount,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: null,
    payoutId: null,
  });
}
