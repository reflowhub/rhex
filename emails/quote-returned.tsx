import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface QuoteReturnedEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  trackingNumber?: string | null;
  shippingAddress?: string | null;
}

/** Sent when an admin marks a trade-in returned (device posted back). */
export default function QuoteReturnedEmail({
  customerName,
  deviceName,
  tradeInRef,
  trackingNumber,
  shippingAddress,
}: QuoteReturnedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            We&apos;ve posted your <strong>{deviceName}</strong> back to you,
            and trade-in <strong>{tradeInRef}</strong> is now closed.
          </Text>

          {(trackingNumber || shippingAddress) && (
            <Section style={callout}>
              {trackingNumber && (
                <Text style={calloutText}>
                  Tracking number: <strong>{trackingNumber}</strong>
                </Text>
              )}
              {shippingAddress && (
                <Text style={calloutDetail}>Sent to {shippingAddress}</Text>
              )}
            </Section>
          )}

          {trackingNumber && (
            <Section style={buttonSection}>
              <Button
                style={button}
                href={`https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(trackingNumber)}`}
              >
                Track Your Parcel
              </Button>
            </Section>
          )}

          <Text style={paragraph}>
            If it doesn&apos;t arrive, or something isn&apos;t right when it
            does, reply to this email and we&apos;ll help.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Questions? Reply to this email or contact us at rhex.app. See our{" "}
            <a href="https://rhex.app/terms/trade-in" style={link}>
              Trade-In Terms &amp; Conditions
            </a>
            .
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

const callout = {
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "16px 0",
};

const calloutText = {
  fontSize: "15px",
  color: "#111827",
  margin: "0 0 4px",
};

const calloutDetail = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0",
};

const buttonSection = {
  textAlign: "center" as const,
  marginTop: "24px",
  marginBottom: "24px",
};

const button = {
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};

const link = {
  color: "#3b82f6",
  textDecoration: "underline",
};
