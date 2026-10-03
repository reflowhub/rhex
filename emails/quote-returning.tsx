import { Text } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import type { ReturningReason } from "@/lib/returning-reason";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteReturningEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  reason: ReturningReason;
  /** When the revised offer ended (reason "expired") */
  revisionExpiredOn?: string | null;
  brand: EmailBrand;
}

/**
 * Mode C: the trade-in won't go ahead and the device is being posted back.
 * The tracking number follows in the returned email.
 */
export default function QuoteReturningEmail({
  customerName,
  deviceName,
  tradeInRef,
  reason,
  revisionExpiredOn,
  brand,
}: QuoteReturningEmailProps) {
  const device = <strong>{deviceName}</strong>;
  return (
    <TradeInLayout brand={brand}>
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        {reason === "declined" && (
          <>You declined the revised offer for your {device}, so we&apos;re posting it back to you at no cost.</>
        )}
        {reason === "expired" && (
          <>
            We didn&apos;t hear back about the revised offer for your {device}
            {revisionExpiredOn ? <> by {revisionExpiredOn}</> : null}, so
            we&apos;re posting it back to you at no cost.
          </>
        )}
        {reason === "rejected" && (
          <>We&apos;re unable to accept your {device} for trade-in, so we&apos;re posting it back to you at no cost.</>
        )}
      </Text>
      <Text style={styles.paragraph}>
        Trade-in <strong>{tradeInRef}</strong> won&apos;t go ahead, and{" "}
        {brand.name} won&apos;t make a trade-in payment for it.
      </Text>
      <Text style={styles.paragraph}>
        We&apos;ll email you the tracking number once your device is on its
        way.
        {reason === "rejected" &&
          " If you'd like to know more, reply to this email."}
      </Text>
    </TradeInLayout>
  );
}
