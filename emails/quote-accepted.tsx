import { Section, Text, Button } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteAcceptedEmailProps {
  customerName: string;
  deviceName: string;
  quotePrice: number;
  currency: string;
  quoteId: string;
  /**
   * Public quotes: RHEX emails a prepaid label and the customer ticked the
   * terms checkbox. Partner (v1) quotes keep the generic copy until the
   * Mode A/B review decides who ships.
   */
  rhexLabel?: boolean;
  /** Mode C partner brand; null or unset for consumer emails */
  brand?: EmailBrand | null;
}

export default function QuoteAcceptedEmail({
  customerName,
  deviceName,
  quotePrice,
  currency,
  quoteId,
  rhexLabel = false,
  brand = null,
}: QuoteAcceptedEmailProps) {
  const quoteUrl = `https://rhex.app/sell/quote/${quoteId}`;

  return (
    <TradeInLayout
      brand={brand}
      footer={
        <>
          {rhexLabel
            ? "When you accepted this quote, you agreed to our "
            : "By accepting this quote, you agree to our "}
          <a href="https://rhex.app/terms/trade-in" style={styles.link}>
            Trade-In Terms &amp; Conditions
          </a>
          . If you have any questions, reply to this email or contact us at
          rhex.app.
        </>
      }
    >
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        Your trade-in quote for <strong>{deviceName}</strong> has been
        accepted. The quoted value is{" "}
        <strong>${quotePrice.toFixed(2)} {currency}</strong>.
      </Text>
      {brand && (
        <Text style={styles.paragraph}>
          Reflow Hub handles {brand.name}&apos;s trade-ins. We buy your device
          under the Trade-In Terms &amp; Conditions you agreed to at checkout,
          and once we&apos;ve received and checked it, {brand.name} refunds
          the trade-in value to your original payment method.
        </Text>
      )}
      {rhexLabel ? (
        <>
          {brand ? (
            // Mode C: the label may come from RHEX or the partner (OPPO.md, 2e)
            <Text style={styles.paragraph}>
              You&apos;ll receive your prepaid Australia Post label by email
              shortly. Once it arrives, you&apos;ll have{" "}
              <strong>14 days</strong> to post your device.
            </Text>
          ) : (
            <Text style={styles.paragraph}>
              We&apos;ll email your prepaid Australia Post label shortly.
              Once we send it, you&apos;ll have <strong>14 days</strong> to
              post your device.
            </Text>
          )}
          <Text style={styles.paragraph}>
            While you wait, get your device ready: pack it in a rigid box
            with bubble wrap or similar padding, back up your data, remove
            your SIM and memory cards, sign out of your accounts and turn
            off Find My / Activation Lock. You supply the packaging.
          </Text>
        </>
      ) : (
        <Text style={styles.paragraph}>
          Please ship your device to us at your earliest convenience. You
          can view your quote details and shipping instructions below:
        </Text>
      )}
      <Section style={styles.buttonSection}>
        <Button style={styles.button} href={quoteUrl}>
          {rhexLabel ? "View Your Trade-In" : "View Quote"}
        </Button>
      </Section>
    </TradeInLayout>
  );
}
