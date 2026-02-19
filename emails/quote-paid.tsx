import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
} from "@react-email/components";

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
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            Payment of <strong>${finalPrice.toFixed(2)} {currency}</strong> for your{" "}
            <strong>{deviceName}</strong> trade-in has been sent via{" "}
            {methodLabel}.
          </Text>
          <Text style={paragraph}>
            Please allow 1-2 business days for the funds to appear in your
            account.
          </Text>
          <Text style={paragraph}>
            Thank you for trading in with rhex!
          </Text>
          {feedbackUrl && (
            <>
              <Hr style={hr} />
              <Text style={paragraph}>
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
              <Hr style={hr} />
              <Text style={paragraph}>
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
          <Hr style={hr} />
          <Text style={footer}>
            If you have any questions about your payment, reply to this email or
            contact us at rhex.app.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "32px",
  borderRadius: "8px",
  maxWidth: "480px",
};

const heading = {
  fontSize: "20px",
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: "24px",
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#374151",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

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

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};
