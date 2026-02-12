import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { calculateShipping, type ShippingConfig } from "@/lib/shipping";

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
      upsellItems: upsellItemsInput,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      currency,
    } = body as {
      items: CheckoutItem[];
      upsellItems?: { upsellId: string; quantity: number }[];
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      shippingAddress: ShippingAddress;
      currency?: string;
    };

    // Validate required fields
    const hasItems = items?.length > 0;
    const hasUpsells = upsellItemsInput && upsellItemsInput.length > 0;
    if (!hasItems && !hasUpsells) {
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

    const inventoryRefs = (items ?? []).map((item) =>
      adminDb.collection("inventory").doc(item.inventoryId)
    );

    // Batch-fetch device info for order line items
    const deviceMap = new Map<string, Record<string, unknown>>();
    if (inventoryRefs.length > 0) {
      const inventorySnaps = await adminDb.getAll(...inventoryRefs);
      const deviceIdSet = new Set<string>();
      for (const snap of inventorySnaps) {
        if (snap.exists) {
          const ref = snap.data()?.deviceRef;
          if (ref) deviceIdSet.add(ref as string);
        }
      }
      if (deviceIdSet.size > 0) {
        const deviceRefs = Array.from(deviceIdSet).map((id) =>
          adminDb.collection("devices").doc(id)
        );
        const deviceDocs = await adminDb.getAll(...deviceRefs);
        deviceDocs.forEach((doc) => {
          if (doc.exists) deviceMap.set(doc.id, doc.data() as Record<string, unknown>);
        });
      }
    }

    // Validate and fetch upsell products
    let upsellOrderItems: { upsellId: string; name: string; priceAUD: number; quantity: number }[] = [];
    if (upsellItemsInput?.length) {
      const upsellRefs = upsellItemsInput.map((u) =>
        adminDb.collection("upsellProducts").doc(u.upsellId)
      );
      const upsellDocs = await adminDb.getAll(...upsellRefs);
      for (let i = 0; i < upsellItemsInput.length; i++) {
        const doc = upsellDocs[i];
        if (!doc.exists || !doc.data()?.active) {
          return NextResponse.json(
            { error: `Add-on product is no longer available` },
            { status: 409 }
          );
        }
        const data = doc.data()!;
        upsellOrderItems.push({
          upsellId: doc.id,
          name: data.name as string,
          priceAUD: data.priceAUD as number,
          quantity: upsellItemsInput[i].quantity,
        });
      }
    }

    // Load shipping config
    const shippingDoc = await adminDb.doc("settings/shipping").get();
    const shippingConfigData = shippingDoc.data() ?? {};
    const shippingConfig: ShippingConfig = {
      rates: shippingConfigData.rates ?? {},
      freeThreshold: shippingConfigData.freeThreshold ?? 0,
      defaultRate: shippingConfigData.defaultRate ?? 10,
    };

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
            priceAUD: data.sellPriceAUD as number,
          };
        });

        const inventorySubtotal = orderItems.reduce(
          (sum, item) => sum + item.priceAUD,
          0
        );
        const upsellSubtotal = upsellOrderItems.reduce(
          (sum, item) => sum + item.priceAUD * item.quantity,
          0
        );
        const subtotalAUD = inventorySubtotal + upsellSubtotal;
        const itemCategories = inventoryDocs.map(
          (doc) => (doc.data()?.category as string) ?? "Phone"
        );
        const shippingAUD = calculateShipping(itemCategories, subtotalAUD, shippingConfig);
        const totalAUD = subtotalAUD + shippingAUD;
        const gstAUD = Math.round((totalAUD / 11) * 100) / 100;

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
          upsellItems: upsellOrderItems,
          subtotalAUD,
          shippingAUD,
          totalAUD,
          gstAUD,
          displayCurrency: currency ?? "AUD",
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
          orderData.items as { description: string; priceAUD: number }[]
        ).map((item) => ({
          price_data: {
            currency: "aud",
            product_data: { name: item.description },
            unit_amount: Math.round(item.priceAUD * 100),
          },
          quantity: 1,
        }));

        // Add upsell items as line items
        const orderUpsells = (orderData.upsellItems ?? []) as {
          name: string;
          priceAUD: number;
          quantity: number;
        }[];
        for (const upsell of orderUpsells) {
          lineItems.push({
            price_data: {
              currency: "aud",
              product_data: { name: upsell.name },
              unit_amount: Math.round(upsell.priceAUD * 100),
            },
            quantity: upsell.quantity,
          });
        }

        // Add shipping as a line item if applicable
        if (orderData.shippingAUD > 0) {
          lineItems.push({
            price_data: {
              currency: "aud",
              product_data: { name: "Shipping" },
              unit_amount: Math.round(orderData.shippingAUD * 100),
            },
            quantity: 1,
          });
        }

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
