import type { ReactElement } from "react";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import {
  customerEmailSwitches,
  emailBrandFor,
  isCustomerEmailSwitch,
  type CustomerEmailSwitch,
  type EmailBrand,
} from "@/lib/partner-config";
import { isModeC } from "@/lib/quote-transitions";
import { routeSandboxEmail, sandboxEmailConfig } from "@/lib/sandbox-email";

/**
 * Customer emails about a quote. Mode C partners can switch some off;
 * re-quote emails (and the consumer-only paid email) always go.
 */
export type QuoteEmailKind =
  | CustomerEmailSwitch
  | "revised"
  | "revisionReminder"
  | "paid";

interface QuoteEmailMessage {
  to: string;
  subject: string;
  react: ReactElement;
  attachments?: EmailAttachment[];
}

/**
 * Send a customer email about a quote, built by `build`.
 *
 * Mode C emails are co-branded: `build` gets the partner's brand, read from
 * the partner when the email is sent, and replies go to its support email.
 * An email the partner has switched off isn't built or sent. Other quotes
 * get `null` and send as before.
 *
 * Production quotes send as given. Sandbox quotes go only to the partner's
 * allow-listed addresses, and everything else to its fallback test inbox
 * (lib/sandbox-email.ts), with the subject marked so test mail is obvious.
 *
 * @returns whether the email was handed to the mailer
 */
export async function sendQuoteEmail(
  quote: Record<string, unknown>,
  kind: QuoteEmailKind,
  build: (brand: EmailBrand | null) => QuoteEmailMessage | Promise<QuoteEmailMessage>
): Promise<boolean> {
  const modeC = isModeC(quote);
  const partnerId = typeof quote.partnerId === "string" ? quote.partnerId : null;
  const partner =
    partnerId && (modeC || quote.sandbox === true)
      ? (await adminDb.collection("partners").doc(partnerId).get()).data()
      : undefined;

  if (modeC && isCustomerEmailSwitch(kind) && !customerEmailSwitches(partner)[kind]) {
    console.log(`[email] ${kind} email switched off for partner ${partnerId}`);
    return false;
  }

  const brand = modeC ? emailBrandFor(partner) : null;
  const msg = await build(brand);
  const replyTo = brand?.supportEmail;

  if (quote.sandbox !== true) {
    await sendEmail({ ...msg, replyTo });
    return true;
  }

  const route = routeSandboxEmail(msg.to, sandboxEmailConfig(partner));
  if (!route) {
    console.log(`[email] sandbox email dropped (no test inbox): "${msg.subject}"`);
    return false;
  }

  await sendEmail({
    ...msg,
    replyTo,
    to: route.to,
    subject: route.redirectedFrom
      ? `[SANDBOX → ${route.redirectedFrom}] ${msg.subject}`
      : `[SANDBOX] ${msg.subject}`,
  });
  return true;
}

/** "Apple iPhone 14 128GB", or "your device" if the device is unknown. */
export async function deviceLabel(deviceId: unknown): Promise<string> {
  if (typeof deviceId !== "string" || !deviceId) return "your device";
  const doc = await adminDb.collection("devices").doc(deviceId).get();
  if (!doc.exists) return "your device";
  const d = doc.data()!;
  return `${d.make} ${d.model} ${d.storage}`.trim();
}
