import { Section, Text, Button } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteExpiredEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  /** Mode C partner brand; null or unset for consumer emails */
  brand?: EmailBrand | null;
  /**
   * Mode C: the partner has been told the trade-in won't go ahead (its
   * never-arrived setting), so a device that turns up can't complete it
   */
  partnerResultSent?: boolean;
}

/**
 * Sent when an accepted trade-in expires unposted (postByAt + 30 days).
 * Mode C customers can only trade in with a partner order, so they get no
 * new-quote link.
 */
export default function QuoteExpiredEmail({
  customerName,
  deviceName,
  tradeInRef,
  brand = null,
  partnerResultSent = false,
}: QuoteExpiredEmailProps) {
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
        We haven&apos;t received your <strong>{deviceName}</strong>, so
        we&apos;ve closed trade-in <strong>{tradeInRef}</strong>
        {/* Mode C: the partner may have made the label (OPPO.md, 2e) */}
        {brand ? "." : " and cancelled its shipping label."}
      </Text>

      <Section style={styles.callout}>
        <Text style={styles.calloutText}>
          <strong>
            {brand ? "Please don't use the shipping label." : "Please don't use that label."}
          </strong>
        </Text>
        <Text style={styles.calloutDetail}>
          {brand
            ? "This trade-in is closed, so it can't be used to send your device."
            : "It has been cancelled and can't be used to send your device."}
        </Text>
      </Section>

      {brand ? (
        <>
          <Text style={styles.paragraph}>
            As we didn&apos;t receive your device, this trade-in won&apos;t go
            ahead and {brand.name} won&apos;t make a trade-in payment for it.
          </Text>
          <Text style={styles.paragraph}>
            {partnerResultSent
              ? "If you've already posted your device, reply to this email with your postage receipt. If it reaches us, we'll contact you to arrange a new trade-in or post it back to you."
              : "If you've already posted your device, reply to this email with your postage receipt and we'll sort it out."}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.paragraph}>
            If you&apos;ve already posted your device, reply to this email with
            your postage receipt and we&apos;ll sort it out.
          </Text>
          <Text style={styles.paragraph}>
            Still want to trade in? Get a new quote. Prices may have changed
            since your original quote.
          </Text>

          <Section style={styles.buttonSection}>
            <Button style={styles.button} href="https://rhex.app/sell">
              Get a New Quote
            </Button>
          </Section>
        </>
      )}
    </TradeInLayout>
  );
}
