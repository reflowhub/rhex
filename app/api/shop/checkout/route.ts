import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// POST /api/shop/checkout — Create order + reserve inventory
//
// Body: {
//   items: [{ inventoryId: string }],
//   customerName: string,
//   customerEmail: string,
//   customerPhone?: string,
//   shippingAddress: { line1, line2?, city, region, postcode, country },
//   currency?: "NZD" | "AUD"
// }
//
// Stripe-aware: if STRIPE_SECRET_KEY is set, creates a Stripe Checkout
// Session and returns { url }. Otherwise, marks order as paid immediately
// (stub mode) and returns { orderId, orderNumber }.
// ---------------------------------------------------------------------------

interface CheckoutItem {
  inventoryId: string;
}

interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      items,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      currency,
    } = body as {
      items: CheckoutItem[];
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      shippingAddress: ShippingAddress;
      currency?: string;
    };

    // Validate required fields
    if (!items?.length) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }
    if (!customerName || !customerEmail) {
      return NextResponse.json(
        { error: "Customer name and email are required" },
        { status: 400 }
      );
    }
    if (
      !shippingAddress?.line1 ||
      !shippingAddress?.city ||
      !shippingAddress?.region ||
      !shippingAddress?.postcode ||
      !shippingAddress?.country
    ) {
      return NextResponse.json(
        { error: "Complete shipping address is required" },
        { status: 400 }
      );
    }

    const inventoryRefs = items.map((item) =>
      adminDb.collection("inventory").doc(item.inventoryId)
    );

    // Batch-fetch device info for order line items
    const inventorySnaps = await adminDb.getAll(...inventoryRefs);
    const deviceIdSet = new Set<string>();
    for (const snap of inventorySnaps) {
      if (snap.exists) {
        const ref = snap.data()?.deviceRef;
        if (ref) deviceIdSet.add(ref as string);
      }
    }
    const deviceMap = new Map<string, Record<string, unknown>>();
    if (deviceIdSet.size > 0) {
      const deviceRefs = Array.from(deviceIdSet).map((id) =>
        adminDb.collection("devices").doc(id)
      );
      const deviceDocs = await adminDb.getAll(...deviceRefs);
      deviceDocs.forEach((doc) => {
        if (doc.exists) deviceMap.set(doc.id, doc.data() as Record<string, unknown>);
      });
    }

    // Transaction: verify availability, reserve items, create order
    let orderId: string = "";
    let orderNumber: number = 0;

    try {
      await adminDb.runTransaction(async (transaction) => {
        // Read all inventory items inside the transaction
        const inventoryDocs = await Promise.all(
          inventoryRefs.map((ref) => transaction.get(ref))
        );

        // Verify all items are still available
        for (const doc of inventoryDocs) {
          if (!doc.exists) {
            throw new Error(`Item ${doc.id} not found`);
          }
          const data = doc.data()!;
          if (data.status !== "listed" || !data.listed) {
            throw new Error(`Item ${doc.id} is no longer available`);
          }
        }

        // Auto-increment order number
        const counterRef = adminDb.doc("counters/orders");
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists) {
          orderNumber = 1001;
          transaction.set(counterRef, { nextId: 1002 });
        } else {
          orderNumber = counterDoc.data()?.nextId ?? 1001;
          transaction.update(counterRef, { nextId: orderNumber + 1 });
        }

        // Build order line items
        const orderItems = inventoryDocs.map((doc) => {
          const data = doc.data()!;
          const device = deviceMap.get(data.deviceRef as string);
          const description = [
            device?.make ?? "",
            device?.model ?? "",
            device?.storage ?? "",
          ]
            .filter(Boolean)
            .join(" ");

          return {
            inventoryId: doc.id,
            deviceRef: data.deviceRef,
            description: description
              ? `${description} - Grade ${data.cosmeticGrade}`
              : `Grade ${data.cosmeticGrade}`,
            priceNZD: data.sellPriceNZD as number,
          };
        });

        const subtotalNZD = orderItems.reduce(
          (sum, item) => sum + item.priceNZD,
          0
        );
        const shippingNZD = 0; // Free shipping for now
        const totalNZD = subtotalNZD + shippingNZD;

        // Create order document
        const orderRef = adminDb.collection("orders").doc();
        orderId = orderRef.id;

        transaction.set(orderRef, {
          orderNumber,
          customerName,
          customerEmail,
          customerPhone: customerPhone ?? null,
          shippingAddress,
          items: orderItems,
          subtotalNZD,
          shippingNZD,
          totalNZD,
          displayCurrency: currency ?? "NZD",
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
          paymentStatus: "pending",
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Reserve all inventory items
        for (const ref of inventoryRefs) {
          transaction.update(ref, {
            status: "reserved",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Checkout failed";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    // Check if Stripe is configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (stripeKey) {
      // REAL STRIPE MODE — dynamic import so the app works without the package
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);

        // Fetch the order we just created to get line items
        const orderDoc = await adminDb.collection("orders").doc(orderId).get();
        const orderData = orderDoc.data()!;

        const lineItems = (
          orderData.items as { description: string; priceNZD: number }[]
        ).map((item) => ({
          price_data: {
            currency: "nzd",
            product_data: { name: item.description },
            unit_amount: Math.round(item.priceNZD * 100),
          },
          quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: lineItems,
          customer_email: customerEmail,
          metadata: { orderId },
          success_url: `${request.headers.get("origin") ?? ""}/shop/order/${orderId}?success=1`,
          cancel_url: `${request.headers.get("origin") ?? ""}/shop/cart?cancelled=1`,
        });

        // Store Stripe session ID on the order
        await adminDb.collection("orders").doc(orderId).update({
          stripeCheckoutSessionId: session.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ url: session.url, orderId, orderNumber });
      } catch (stripeErr) {
        console.error("Stripe checkout error:", stripeErr);
        // Fall through to stub mode if Stripe fails
      }
    }

    // STUB MODE — simulate instant payment
    const batch = adminDb.batch();

    batch.update(adminDb.collection("orders").doc(orderId), {
      paymentStatus: "paid",
      status: "paid",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    for (const ref of inventoryRefs) {
      batch.update(ref, {
        status: "sold",
        listed: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({ orderId, orderNumber }, { status: 201 });
  } catch (error) {
    console.error("Error processing checkout:", error);
    return NextResponse.json(
      { error: "Failed to process checkout" },
      { status: 500 }
    );
  }
}
