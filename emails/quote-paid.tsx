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
}

export default function QuotePaidEmail({
  customerName,
  deviceName,
  finalPrice,
  currency,
  paymentMethod,
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

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};
