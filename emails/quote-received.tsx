import { Section, Text, Button } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteReceivedEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  /** The quoted trade-in value, e.g. 180 */
  quotePrice: number;
  currency: string;
  quoteId: string;
  brand: EmailBrand;
}

/** Mode C: the device has arrived and is waiting for inspection. */
export default function QuoteReceivedEmail({
  customerName,
  deviceName,
  tradeInRef,
  quotePrice,
  currency,
  quoteId,
  brand,
}: QuoteReceivedEmailProps) {
  return (
    <TradeInLayout brand={brand}>
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        We&apos;ve received your <strong>{deviceName}</strong> (trade-in{" "}
        <strong>{tradeInRef}</strong>). Thanks for sending it in.
      </Text>
      <Text style={styles.paragraph}>
        Next, we&apos;ll wipe your data and inspect the device.
      </Text>
      <Section style={styles.callout}>
        <Text style={styles.calloutText}>
          If it matches your trade-in, your trade-in value of{" "}
          <strong>${quotePrice.toFixed(2)} {currency}</strong> is approved and{" "}
          {brand.name} refunds it to your original payment method.
        </Text>
        <Text style={styles.calloutDetail}>
          If it doesn&apos;t, we&apos;ll email you a revised offer to accept or
          decline.
        </Text>
      </Section>
      <Section style={styles.buttonSection}>
        <Button style={styles.button} href={`https://rhex.app/sell/quote/${quoteId}`}>
          View Your Trade-In
        </Button>
      </Section>
    </TradeInLayout>
  );
}
