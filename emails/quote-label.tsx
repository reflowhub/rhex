import { Section, Text, Button } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteLabelEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  trackingNumber: string;
  postBy: string;
  quoteId: string;
  /** Mode C partner brand; null or unset for consumer emails */
  brand?: EmailBrand | null;
}

export default function QuoteLabelEmail({
  customerName,
  deviceName,
  tradeInRef,
  trackingNumber,
  postBy,
  quoteId,
  brand = null,
}: QuoteLabelEmailProps) {
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
        Your prepaid Australia Post label for <strong>{deviceName}</strong>{" "}
        is attached. Your trade-in reference is{" "}
        <strong>{tradeInRef}</strong>.
      </Text>

      <Section style={styles.callout}>
        <Text style={styles.calloutText}>
          Use your label by <strong>{postBy}</strong>.
        </Text>
        <Text style={styles.calloutDetail}>Tracking number: {trackingNumber}</Text>
      </Section>

      <Text style={subheading}>How to send your device</Text>
      <Text style={listItem}>
        1. Back up your data, remove your SIM and memory cards, sign out of
        your accounts and turn off Find My / Activation Lock.
      </Text>
      <Text style={listItem}>
        2. Pack it in a rigid box with bubble wrap or similar padding so it
        can&apos;t move around. Leave out cases, chargers and accessories.
      </Text>
      <Text style={listItem}>
        3. Put a note inside the box with your reference{" "}
        <strong>{tradeInRef}</strong>.
      </Text>
      <Text style={listItem}>
        4. Print the label, attach it to the box and drop it at any
        Australia Post outlet or street posting box. Keep your receipt.
      </Text>

      <Section style={styles.buttonSection}>
        <Button style={styles.button} href={quoteUrl}>
          View Your Trade-In
        </Button>
      </Section>
      <Text style={styles.paragraph}>
        Once it&apos;s on its way, you can let us know from your trade-in
        page. The label can only be used once, for this device.
      </Text>
    </TradeInLayout>
  );
}

const subheading = {
  fontSize: "15px",
  fontWeight: "600" as const,
  color: "#111827",
  marginTop: "24px",
};

const listItem = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  margin: "6px 0",
};
