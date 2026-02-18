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

interface OrderShippedEmailProps {
  customerName: string;
  orderNumber: string;
  orderId: string;
  trackingNumber: string;
  trackingCarrier: string;
}

const TRACKING_URLS: Record<string, string> = {
  "NZ Post": "https://www.nzpost.co.nz/tools/tracking/item/",
  CourierPost: "https://www.courierpost.co.nz/tools/tracking/item/",
  AusPost: "https://auspost.com.au/mypost/track/#/details/",
};

export default function OrderShippedEmail({
  customerName,
  orderNumber,
  orderId,
  trackingNumber,
  trackingCarrier,
}: OrderShippedEmailProps) {
  const orderUrl = `https://rhex.app/buy/order/${orderId}`;
  const trackingUrl = TRACKING_URLS[trackingCarrier]
    ? `${TRACKING_URLS[trackingCarrier]}${trackingNumber}`
    : null;

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            Your order <strong>#{orderNumber}</strong> has been shipped via{" "}
            {trackingCarrier}.
          </Text>
          <Section style={trackingSection}>
            <Text style={trackingLabel}>Tracking number</Text>
            <Text style={trackingValue}>{trackingNumber}</Text>
          </Section>
          {trackingUrl && (
            <Section style={buttonSection}>
              <Button style={button} href={trackingUrl}>
                Track Package
              </Button>
            </Section>
          )}
          <Section style={buttonSection}>
            <Button style={secondaryButton} href={orderUrl}>
              View Order
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you have any questions, reply to this email or contact us at
            rhex.app.
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

const trackingSection = {
  backgroundColor: "#f9fafb",
  padding: "16px",
  borderRadius: "6px",
  marginTop: "16px",
  marginBottom: "16px",
  textAlign: "center" as const,
};

const trackingLabel = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const trackingValue = {
  fontSize: "18px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0",
};

const buttonSection = {
  textAlign: "center" as const,
  marginTop: "16px",
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

const secondaryButton = {
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  border: "1px solid #d1d5db",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};
