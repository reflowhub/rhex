import { Section, Text, Button } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteReturnedEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  trackingNumber?: string | null;
  shippingAddress?: string | null;
  /** Mode C partner brand; null or unset for consumer emails */
  brand?: EmailBrand | null;
}

/** Sent when an admin marks a trade-in returned (device posted back). */
export default function QuoteReturnedEmail({
  customerName,
  deviceName,
  tradeInRef,
  trackingNumber,
  shippingAddress,
  brand = null,
}: QuoteReturnedEmailProps) {
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
        We&apos;ve posted your <strong>{deviceName}</strong> back to you,
        and trade-in <strong>{tradeInRef}</strong> is now closed.
      </Text>

      {(trackingNumber || shippingAddress) && (
        <Section style={styles.callout}>
          {trackingNumber && (
            <Text style={styles.calloutText}>
              Tracking number: <strong>{trackingNumber}</strong>
            </Text>
          )}
          {shippingAddress && (
            <Text style={styles.calloutDetail}>Sent to {shippingAddress}</Text>
          )}
        </Section>
      )}

      {trackingNumber && (
        <Section style={styles.buttonSection}>
          <Button
            style={styles.button}
            href={`https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(trackingNumber)}`}
          >
            Track Your Parcel
          </Button>
        </Section>
      )}

      <Text style={styles.paragraph}>
        If it doesn&apos;t arrive, or something isn&apos;t right when it
        does, reply to this email and we&apos;ll help.
      </Text>
    </TradeInLayout>
  );
}
