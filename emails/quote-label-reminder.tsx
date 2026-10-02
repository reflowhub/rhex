import { Section, Text, Button } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteLabelReminderEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  postBy: string;
  quoteId: string;
  /** The last reminder before postBy */
  final: boolean;
  /** Mode C partner brand; null or unset for consumer emails */
  brand?: EmailBrand | null;
}

/** Day-7 and day-12 reminders to post the device (docs/TRADEIN-STATES-PLAN.md §3). */
export default function QuoteLabelReminderEmail({
  customerName,
  deviceName,
  tradeInRef,
  postBy,
  quoteId,
  final,
  brand = null,
}: QuoteLabelReminderEmailProps) {
  const quoteUrl = `https://rhex.app/sell/quote/${quoteId}`;

  return (
    <TradeInLayout
      brand={brand}
      footer={
        <>
          Questions? Reply to this email or contact us at rhex.app. See our{" "}
          <a href="https://rhex.app/terms/trade-in" style={styles.link}>
            Trade-In Terms &amp; Conditions
          </a>
          .
        </>
      }
    >
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        {final
          ? "Just a final reminder: "
          : "A quick reminder: "}
        your <strong>{deviceName}</strong> (trade-in{" "}
        <strong>{tradeInRef}</strong>) needs to be posted with the prepaid
        label we sent you.
      </Text>

      <Section style={styles.callout}>
        <Text style={styles.calloutText}>
          Post by <strong>{postBy}</strong>.
        </Text>
        <Text style={styles.calloutDetail}>
          Drop it at any Australia Post outlet or street posting box.
        </Text>
      </Section>

      <Text style={styles.paragraph}>
        Pack it in a rigid box with padding, and put a note inside with
        your reference <strong>{tradeInRef}</strong>. You can download your
        label again from your trade-in page.
      </Text>

      <Section style={styles.buttonSection}>
        <Button style={styles.button} href={quoteUrl}>
          View Your Trade-In
        </Button>
      </Section>
      <Text style={styles.paragraph}>
        Already posted it? Let us know from your trade-in page and we&apos;ll
        stop these reminders.
      </Text>
    </TradeInLayout>
  );
}
