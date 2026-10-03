import { Text, Section, Column, Row } from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuoteRevisedEmailProps {
  customerName: string;
  deviceName: string;
  originalGrade: string;
  revisedGrade: string;
  originalPrice: number;
  revisedPrice: number;
  currency: string;
  quoteUrl: string;
  expiresAt: string;
  deviceChanged: boolean;
  revisedDeviceName?: string;
  /** Mode C partner brand; null or unset for consumer emails */
  brand?: EmailBrand | null;
  /** Mode C: the reminder sent 48 hours before expiresAt */
  reminder?: boolean;
}

export default function QuoteRevisedEmail({
  customerName,
  deviceName,
  originalGrade,
  revisedGrade,
  originalPrice,
  revisedPrice,
  currency,
  quoteUrl,
  expiresAt,
  deviceChanged,
  revisedDeviceName,
  brand = null,
  reminder = false,
}: QuoteRevisedEmailProps) {
  return (
    <TradeInLayout
      brand={brand}
      footer="If you have any questions, reply to this email or contact us at rhex.app."
    >
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      {reminder ? (
        <Text style={styles.paragraph}>
          Just a reminder: we&apos;re waiting for your answer to the revised
          offer for your device. It ends on <strong>{expiresAt}</strong>.
        </Text>
      ) : (
        <Text style={styles.paragraph}>
          We&apos;ve received and inspected your device. After inspection, we
          found that it differs from the original quote. Please review the
          changes below.
        </Text>
      )}

      <Section style={comparisonSection}>
        <Row>
          <Column style={comparisonColumn}>
            <Text style={comparisonLabel}>Original Quote</Text>
            <Text style={comparisonDevice}>{deviceName}</Text>
            <Text style={comparisonDetail}>Grade {originalGrade}</Text>
            <Text style={comparisonPrice}>
              ${originalPrice.toFixed(2)} {currency}
            </Text>
          </Column>
          <Column style={comparisonColumn}>
            <Text style={comparisonLabel}>Revised Quote</Text>
            <Text style={comparisonDevice}>
              {deviceChanged && revisedDeviceName
                ? revisedDeviceName
                : deviceName}
            </Text>
            <Text style={comparisonDetail}>Grade {revisedGrade}</Text>
            <Text style={comparisonPriceRevised}>
              ${revisedPrice.toFixed(2)} {currency}
            </Text>
          </Column>
        </Row>
      </Section>

      {brand ? (
        <>
          <Text style={styles.paragraph}>
            Please accept or decline this revised offer by{" "}
            <strong>{expiresAt}</strong>.
          </Text>
          <Text style={styles.paragraph}>
            If you accept, {brand.name} will make a trade-in payment of{" "}
            <strong>${revisedPrice.toFixed(2)} {currency}</strong> to the
            payment method you used for your {brand.name} order once your
            trade-in is approved. If you decline, or we don&apos;t hear from
            you by then, we&apos;ll post your device back to you at no cost
            and {brand.name} won&apos;t make a trade-in payment.
          </Text>
        </>
      ) : (
        <Text style={styles.paragraph}>
          Please accept or reject this revised offer by{" "}
          <strong>{expiresAt}</strong>. If we don&apos;t hear from you by
          then, your device will be returned to you.
        </Text>
      )}

      <Text style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={quoteUrl} style={actionButton}>
          Review &amp; Respond
        </a>
      </Text>
    </TradeInLayout>
  );
}

const comparisonSection = {
  margin: "24px 0",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

const comparisonColumn = {
  padding: "16px",
  verticalAlign: "top" as const,
  width: "50%",
};

const comparisonLabel = {
  fontSize: "11px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  color: "#9ca3af",
  marginBottom: "8px",
};

const comparisonDevice = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#111827",
  marginBottom: "4px",
};

const comparisonDetail = {
  fontSize: "13px",
  color: "#6b7280",
  marginBottom: "8px",
};

const comparisonPrice = {
  fontSize: "16px",
  fontWeight: "700" as const,
  color: "#374151",
};

const comparisonPriceRevised = {
  fontSize: "16px",
  fontWeight: "700" as const,
  color: "#d97706",
};

const actionButton = {
  backgroundColor: "#111827",
  color: "#ffffff",
  padding: "12px 32px",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "600" as const,
  textDecoration: "none",
};
