import { Text, Hr } from "@react-email/components";
import TradeInLayout, { styles } from "./trade-in-layout";

interface QuotePaidEmailProps {
  customerName: string;
  deviceName: string;
  finalPrice: number;
  currency: string;
  paymentMethod: string;
  googleReviewUrl?: string;
  feedbackUrl?: string;
}

export default function QuotePaidEmail({
  customerName,
  deviceName,
  finalPrice,
  currency,
  paymentMethod,
  googleReviewUrl,
  feedbackUrl,
}: QuotePaidEmailProps) {
  const methodLabel = paymentMethod === "payid" ? "PayID" : "bank transfer";

  return (
    <TradeInLayout
      brand={null}
      footer="If you have any questions about your payment, reply to this email or contact us at rhex.app."
    >
      <Text style={styles.paragraph}>Hi {customerName},</Text>
      <Text style={styles.paragraph}>
        Payment of <strong>${finalPrice.toFixed(2)} {currency}</strong> for your{" "}
        <strong>{deviceName}</strong> trade-in has been sent via{" "}
        {methodLabel}.
      </Text>
      <Text style={styles.paragraph}>
        Please allow 1-2 business days for the funds to appear in your
        account.
      </Text>
      <Text style={styles.paragraph}>
        Thank you for trading in with rhex!
      </Text>
      {feedbackUrl && (
        <>
          <Hr style={styles.hr} />
          <Text style={styles.paragraph}>
            Tell us how your trade-in went and go in the draw to win a
            monthly prize!
          </Text>
          <Text style={{ textAlign: "center" as const, margin: "16px 0" }}>
            <a href={feedbackUrl} style={raffleButton}>
              Rate Your Experience
            </a>
          </Text>
          <Text style={smallText}>
            One entry per trade-in. Winners drawn monthly.
          </Text>
        </>
      )}
      {googleReviewUrl && (
        <>
          <Hr style={styles.hr} />
          <Text style={styles.paragraph}>
            Had a great experience? We'd really appreciate a quick Google
            review — it helps others find us!
          </Text>
          <Text style={{ textAlign: "center" as const, margin: "16px 0" }}>
            <a href={googleReviewUrl} style={reviewButton}>
              Leave a Google Review
            </a>
          </Text>
        </>
      )}
    </TradeInLayout>
  );
}

const raffleButton = {
  backgroundColor: "#059669",
  color: "#ffffff",
  padding: "10px 24px",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "600" as const,
  textDecoration: "none",
};

const smallText = {
  fontSize: "12px",
  lineHeight: "20px",
  color: "#9ca3af",
  textAlign: "center" as const,
};

const reviewButton = {
  backgroundColor: "#1a73e8",
  color: "#ffffff",
  padding: "10px 24px",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "600" as const,
  textDecoration: "none",
};

