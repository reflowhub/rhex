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

interface QuoteExpiredEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
}

/** Sent when an accepted trade-in expires unposted (postByAt + 30 days). */
export default function QuoteExpiredEmail({
  customerName,
  deviceName,
  tradeInRef,
}: QuoteExpiredEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            We haven&apos;t received your <strong>{deviceName}</strong>, so
            we&apos;ve closed trade-in <strong>{tradeInRef}</strong> and
            cancelled its shipping label.
          </Text>

          <Section style={callout}>
            <Text style={calloutText}>
              <strong>Please don&apos;t use that label.</strong>
            </Text>
            <Text style={calloutDetail}>
              It has been cancelled and can&apos;t be used to send your device.
            </Text>
          </Section>

          <Text style={paragraph}>
            If you&apos;ve already posted your device, reply to this email with
            your postage receipt and we&apos;ll sort it out.
          </Text>
          <Text style={paragraph}>
            Still want to trade in? Get a new quote. Prices may have changed
            since your original quote.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href="https://rhex.app/sell">
              Get a New Quote
            </Button>
          </Section>
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
