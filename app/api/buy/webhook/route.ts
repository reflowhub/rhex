import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import OrderConfirmedEmail from "@/emails/order-confirmed";

// ---------------------------------------------------------------------------
// POST /api/shop/webhook — Stripe webhook handler
//
// Processes checkout.session.completed events to mark orders as paid
// and inventory items as sold.
//
// Returns 501 if Stripe is not configured.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 501 }
    );
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        console.error("Webhook: no orderId in session metadata");
        return NextResponse.json({ received: true });
      }

      const orderDoc = await adminDb.collection("orders").doc(orderId).get();
      if (!orderDoc.exists) {
        console.error(`Webhook: order ${orderId} not found`);
        return NextResponse.json({ received: true });
      }

      const orderData = orderDoc.data()!;

      // Skip if already paid
      if (orderData.paymentStatus === "paid") {
        return NextResponse.json({ received: true });
      }

      const batch = adminDb.batch();

      // Mark order as paid
      batch.update(adminDb.collection("orders").doc(orderId), {
        paymentStatus: "paid",
        status: "paid",
        stripePaymentIntentId: session.payment_intent ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark inventory items as sold
      const items = orderData.items as { inventoryId: string }[];
      for (const item of items) {
        batch.update(adminDb.collection("inventory").doc(item.inventoryId), {
          status: "sold",
          listed: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      // Send order confirmation email (non-blocking)
      if (orderData.customerEmail) {
        const orderItems = (orderData.items as { description?: string; priceAUD?: number }[]) ?? [];
        sendEmail({
          to: orderData.customerEmail as string,
          subject: `Order #${orderData.orderNumber} confirmed`,
          react: OrderConfirmedEmail({
            customerName: (orderData.customerName as string) ?? "there",
            orderNumber: String(orderData.orderNumber ?? orderId),
            orderId,
            items: orderItems.map((item) => ({
              description: item.description ?? "Device",
              priceAUD: item.priceAUD ?? 0,
            })),
            totalAUD: (orderData.totalAUD as number) ?? 0,
          }),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
