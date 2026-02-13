import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerLinkInput {
  type: "individual" | "business";
  name: string;
  email: string;
  phone?: string | null;
  businessName?: string | null;
  shippingAddress?: string | null;
  paymentMethod?: string | null;
  payIdPhone?: string | null;
  bankBSB?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  quoteId?: string;
  bulkQuoteId?: string;
  quoteValueNZD: number;
}

// ---------------------------------------------------------------------------
// findOrCreateCustomer
// ---------------------------------------------------------------------------

export async function findOrCreateCustomer(
  input: CustomerLinkInput
): Promise<string> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Search for existing customer by email
  const snapshot = await adminDb
    .collection("customers")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    // Update existing customer
    const existingDoc = snapshot.docs[0];

    const updateData: Record<string, unknown> = {
      updatedAt: now,
      name: input.name || existingDoc.data().name,
      phone: input.phone || existingDoc.data().phone,
      lastActivityAt: new Date().toISOString(),
      totalQuotes: admin.firestore.FieldValue.increment(1),
      totalValueNZD: admin.firestore.FieldValue.increment(input.quoteValueNZD),
    };

    // Upgrade to business type if a bulk quote is being linked
    if (input.type === "business" && existingDoc.data().type === "individual") {
      updateData.type = "business";
    }

    if (input.businessName) {
      updateData.businessName = input.businessName;
    }

    if (input.shippingAddress) {
      updateData.shippingAddress = input.shippingAddress;
    }

    if (input.paymentMethod) {
      updateData.paymentMethod = input.paymentMethod;
      updateData.payIdPhone = input.payIdPhone || null;
      updateData.bankBSB = input.bankBSB || null;
      updateData.bankAccountNumber = input.bankAccountNumber || null;
      updateData.bankAccountName = input.bankAccountName || null;
    }

    if (input.quoteId) {
      updateData.quoteIds = admin.firestore.FieldValue.arrayUnion(input.quoteId);
    }
    if (input.bulkQuoteId) {
      updateData.bulkQuoteIds = admin.firestore.FieldValue.arrayUnion(
        input.bulkQuoteId
      );
    }

    await existingDoc.ref.update(updateData);
    return existingDoc.id;
  } else {
    // Create new customer
    const customerData: Record<string, unknown> = {
      type: input.type,
      name: input.name,
      email: normalizedEmail,
      phone: input.phone || null,
      businessName: input.businessName || null,
      shippingAddress: input.shippingAddress || null,
      paymentMethod: input.paymentMethod || null,
      payIdPhone: input.payIdPhone || null,
      bankBSB: input.bankBSB || null,
      bankAccountNumber: input.bankAccountNumber || null,
      bankAccountName: input.bankAccountName || null,
      quoteIds: input.quoteId ? [input.quoteId] : [],
      bulkQuoteIds: input.bulkQuoteId ? [input.bulkQuoteId] : [],
      totalQuotes: 1,
      totalValueNZD: input.quoteValueNZD,
      lastActivityAt: new Date().toISOString(),
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("customers").add(customerData);
    return ref.id;
  }
}

// ---------------------------------------------------------------------------
// Types (Orders)
// ---------------------------------------------------------------------------

interface OrderCustomerLinkInput {
  name: string;
  email: string;
  phone?: string | null;
  shippingAddress?: string | null;
  orderId: string;
  orderValueAUD: number;
}

// ---------------------------------------------------------------------------
// findOrCreateOrderCustomer
// ---------------------------------------------------------------------------

export async function findOrCreateOrderCustomer(
  input: OrderCustomerLinkInput
): Promise<string> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const snapshot = await adminDb
    .collection("customers")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const existingDoc = snapshot.docs[0];

    const updateData: Record<string, unknown> = {
      updatedAt: now,
      name: input.name || existingDoc.data().name,
      phone: input.phone || existingDoc.data().phone,
      lastActivityAt: new Date().toISOString(),
      totalOrders: admin.firestore.FieldValue.increment(1),
      totalOrderValueAUD: admin.firestore.FieldValue.increment(
        input.orderValueAUD
      ),
      orderIds: admin.firestore.FieldValue.arrayUnion(input.orderId),
    };

    if (input.shippingAddress) {
      updateData.shippingAddress = input.shippingAddress;
    }

    await existingDoc.ref.update(updateData);
    return existingDoc.id;
  } else {
    const customerData: Record<string, unknown> = {
      type: "individual",
      name: input.name,
      email: normalizedEmail,
      phone: input.phone || null,
      businessName: null,
      shippingAddress: input.shippingAddress || null,
      paymentMethod: null,
      payIdPhone: null,
      bankBSB: null,
      bankAccountNumber: null,
      bankAccountName: null,
      quoteIds: [],
      bulkQuoteIds: [],
      orderIds: [input.orderId],
      totalQuotes: 0,
      totalValueNZD: 0,
      totalOrders: 1,
      totalOrderValueAUD: input.orderValueAUD,
      lastActivityAt: new Date().toISOString(),
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("customers").add(customerData);
    return ref.id;
  }
}
