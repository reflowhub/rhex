import type { ReactElement } from "react";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { routeSandboxEmail, sandboxEmailConfig } from "@/lib/sandbox-email";

/**
 * Send a customer email about a quote. Production quotes send as given.
 * Sandbox quotes go only to the partner's allow-listed addresses, and
 * everything else to its fallback test inbox (lib/sandbox-email.ts), with
 * the subject marked so test mail is obvious.
 */
export async function sendQuoteEmail(
  quote: Record<string, unknown>,
  msg: {
    to: string;
    subject: string;
    react: ReactElement;
    attachments?: EmailAttachment[];
  }
): Promise<void> {
  if (quote.sandbox !== true) {
    await sendEmail(msg);
    return;
  }

  const partnerId = typeof quote.partnerId === "string" ? quote.partnerId : null;
  const partner = partnerId
    ? (await adminDb.collection("partners").doc(partnerId).get()).data()
    : undefined;
  const route = routeSandboxEmail(msg.to, sandboxEmailConfig(partner));
  if (!route) {
    console.log(`[email] sandbox email dropped (no test inbox): "${msg.subject}"`);
    return;
  }

  await sendEmail({
    ...msg,
    to: route.to,
    subject: route.redirectedFrom
      ? `[SANDBOX → ${route.redirectedFrom}] ${msg.subject}`
      : `[SANDBOX] ${msg.subject}`,
  });
}
