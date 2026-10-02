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

interface QuoteLabelEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  trackingNumber: string;
  postBy: string;
  quoteId: string;
}

export default function QuoteLabelEmail({
  customerName,
  deviceName,
  tradeInRef,
  trackingNumber,
  postBy,
  quoteId,
}: QuoteLabelEmailProps) {
  const quoteUrl = `https://rhex.app/sell/quote/${quoteId}`;

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            Your prepaid Australia Post label for <strong>{deviceName}</strong>{" "}
            is attached. Your trade-in reference is{" "}
            <strong>{tradeInRef}</strong>.
          </Text>

          <Section style={callout}>
            <Text style={calloutText}>
              Use your label by <strong>{postBy}</strong>.
            </Text>
            <Text style={calloutDetail}>Tracking number: {trackingNumber}</Text>
          </Section>

          <Text style={subheading}>How to send your device</Text>
          <Text style={listItem}>
            1. Back up your data, remove your SIM and memory cards, sign out of
            your accounts and turn off Find My / Activation Lock.
          </Text>
          <Text style={listItem}>
            2. Pack it in a rigid box with bubble wrap or similar padding so it
            can&apos;t move around. Leave out cases, chargers and accessories.
          </Text>
          <Text style={listItem}>
            3. Put a note inside the box with your reference{" "}
            <strong>{tradeInRef}</strong>.
          </Text>
          <Text style={listItem}>
            4. Print the label, attach it to the box and drop it at any
            Australia Post outlet or street posting box. Keep your receipt.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={quoteUrl}>
              View Your Trade-In
            </Button>
          </Section>
          <Text style={paragraph}>
            Once it&apos;s on its way, you can let us know from your trade-in
            page. The label can only be used once, for this device.
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

const subheading = {
  fontSize: "15px",
  fontWeight: "600" as const,
  color: "#111827",
  marginTop: "24px",
};

const paragraph = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#374151",
};

const listItem = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  margin: "6px 0",
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
