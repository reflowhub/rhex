import { Section, Text } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteCancelledEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  /** Cancelled because Australia Post confirmed the parcel lost */
  lostInTransit: boolean;
  /** Cancelled because the customer asked */
  customerRequest: boolean;
  /** An unused label was sent, and is now cancelled */
  hadLabel: boolean;
  brand: EmailBrand;
}

/**
 * Mode C: an admin cancelled the trade-in before the device arrived (the
 * customer asked, the parcel was lost, or another reason). Not sent for fake
 * or duplicate acceptances (lib/quote-transitions.ts).
 */
export default function QuoteCancelledEmail({
  customerName,
  deviceName,
  tradeInRef,
  lostInTransit,
  customerRequest,
  hadLabel,
  brand,
}: QuoteCancelledEmailProps) {
  const device = <strong>{deviceName}</strong>;
  const ref = <strong>{tradeInRef}</strong>;
  return (
    <TradeInLayout brand={brand}>
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        {lostInTransit ? (
          <>
            Australia Post has confirmed that the parcel with your {device} has
            been lost, so we&apos;ve closed trade-in {ref}.
          </>
        ) : customerRequest ? (
          <>As you asked, we&apos;ve cancelled trade-in {ref} for your {device}.</>
        ) : (
          <>We&apos;ve cancelled trade-in {ref} for your {device}.</>
        )}
      </Text>
      {hadLabel && !lostInTransit && (
        <Section style={styles.callout}>
          <Text style={styles.calloutText}>
            <strong>Please don&apos;t use the shipping label.</strong>
          </Text>
          <Text style={styles.calloutDetail}>
            It has been cancelled and can&apos;t be used to send your device.
          </Text>
        </Section>
      )}
      <Text style={styles.paragraph}>
        This trade-in won&apos;t go ahead, and {brand.name} won&apos;t refund a
        trade-in value for it.
      </Text>
      <Text style={styles.paragraph}>
        {lostInTransit
          ? "If your parcel reaches us after all, we'll contact you to arrange a new trade-in or post your device back to you."
          : "If you've already posted your device, reply to this email. If it reaches us, we'll contact you to arrange a new trade-in or post it back to you."}
      </Text>
    </TradeInLayout>
  );
}
