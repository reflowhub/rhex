import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { readGrades } from "@/lib/grades";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  | "inline_edit"
  | "bulk_adjust"
  | "csv_upload"
  | "device_toggle"
  | "device_delete";

export interface AuditEntry {
  id: string;
  timestamp: string;
  adminUid: string;
  adminEmail: string;
  action: AuditAction;
  priceListId: string | null;
  category: string;
  summary: string;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// logPriceAudit — Write a single audit log entry
// ---------------------------------------------------------------------------

export async function logPriceAudit(params: {
  adminUid: string;
  adminEmail: string;
  action: AuditAction;
  priceListId: string | null;
  category: string;
  summary: string;
  details: Record<string, unknown>;
}): Promise<string> {
  try {
    const ref = await adminDb.collection("priceAuditLog").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      action: params.action,
      priceListId: params.priceListId,
      category: params.category,
      summary: params.summary,
      details: params.details,
    });
    return ref.id;
  } catch (error) {
    // Audit logging should never fail the primary operation
    console.error("Failed to write audit log:", error);
    return "";
  }
}

// ---------------------------------------------------------------------------
// createPriceSnapshot — Capture full price list state before overwrite
// ---------------------------------------------------------------------------

export async function createPriceSnapshot(params: {
  priceListId: string;
  category: string;
  adminUid: string;
  adminEmail: string;
}): Promise<string> {
  try {
    const pricesSnapshot = await adminDb
      .collection(`priceLists/${params.priceListId}/prices`)
      .get();

    const prices: Record<string, Record<string, number>> = {};
    pricesSnapshot.docs.forEach((doc) => {
      prices[doc.id] = readGrades(doc.data() as Record<string, unknown>);
    });

    const ref = await adminDb.collection("priceListSnapshots").add({
      priceListId: params.priceListId,
      category: params.category,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      deviceCount: pricesSnapshot.docs.length,
      prices,
    });
    return ref.id;
  } catch (error) {
    console.error("Failed to create price snapshot:", error);
    return "";
  }
}
