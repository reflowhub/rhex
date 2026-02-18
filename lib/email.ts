import { Resend } from "resend";
import { ReactElement } from "react";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_FROM = process.env.EMAIL_FROM ?? "rhex <noreply@rhex.com>";

/**
 * Send a transactional email via Resend.
 * Non-blocking: logs errors but never throws.
 * No-op when RESEND_API_KEY is unset (dev/CI).
 */
export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}) {
  if (!resend) {
    console.log(`[email] skipped (no API key): "${subject}" → ${to}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      react,
    });

    if (error) {
      console.error(`[email] send error: "${subject}" → ${to}`, error);
    }
  } catch (err) {
    console.error(`[email] unexpected error: "${subject}" → ${to}`, err);
  }
}
