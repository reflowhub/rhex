import { Section, Text } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteApprovedEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  /** The approved trade-in value: original, or an accepted revised offer */
  finalPrice: number;
  currency: string;
  brand: EmailBrand;
}

/**
 * Mode C: replaces the "Payment sent" email. The partner refunds the
 * customer. Wording agreed in docs/partners/OPPO.md (2b); never shows the
 * partner's bonus amount.
 */
export default function QuoteApprovedEmail({
  customerName,
  deviceName,
  tradeInRef,
  finalPrice,
  currency,
  brand,
}: QuoteApprovedEmailProps) {
  const value = `$${finalPrice.toFixed(2)} ${currency}`;
  return (
    <TradeInLayout brand={brand}>
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        We&apos;ve finished inspecting your <strong>{deviceName}</strong>{" "}
        (trade-in <strong>{tradeInRef}</strong>).
      </Text>
      <Section style={styles.callout}>
        <Text style={styles.calloutText}>
          Your trade-in value of <strong>{value}</strong> is approved.{" "}
          {brand.name} will refund {value} to your original payment method.
          Any {brand.name} bonus credit is applied by {brand.name} under its
          promotion terms.
        </Text>
      </Section>
      <Text style={styles.paragraph}>Thanks for trading in.</Text>
    </TradeInLayout>
  );
}
