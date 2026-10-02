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

interface QuoteAcceptedEmailProps {
  customerName: string;
  deviceName: string;
  quotePrice: number;
  currency: string;
  quoteId: string;
  /**
   * Public quotes: RHEX emails a prepaid label and the customer ticked the
   * terms checkbox. Partner (v1) quotes keep the generic copy until the
   * Mode A/B review decides who ships.
   */
  rhexLabel?: boolean;
}

export default function QuoteAcceptedEmail({
  customerName,
  deviceName,
  quotePrice,
  currency,
  quoteId,
  rhexLabel = false,
}: QuoteAcceptedEmailProps) {
  const quoteUrl = `https://rhex.app/sell/quote/${quoteId}`;

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            Your trade-in quote for <strong>{deviceName}</strong> has been
            accepted. The quoted value is{" "}
            <strong>${quotePrice.toFixed(2)} {currency}</strong>.
          </Text>
          {rhexLabel ? (
            <>
              <Text style={paragraph}>
                We&apos;ll email your prepaid Australia Post label shortly.
                Once we send it, you&apos;ll have <strong>14 days</strong> to
                post your device.
              </Text>
              <Text style={paragraph}>
                While you wait, get your device ready: pack it in a rigid box
                with bubble wrap or similar padding, back up your data, remove
                your SIM and memory cards, sign out of your accounts and turn
                off Find My / Activation Lock. You supply the packaging.
              </Text>
            </>
          ) : (
            <Text style={paragraph}>
              Please ship your device to us at your earliest convenience. You
              can view your quote details and shipping instructions below:
            </Text>
          )}
          <Section style={buttonSection}>
            <Button style={button} href={quoteUrl}>
              {rhexLabel ? "View Your Trade-In" : "View Quote"}
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            {rhexLabel
              ? "When you accepted this quote, you agreed to our "
              : "By accepting this quote, you agree to our "}
            <a href="https://rhex.app/terms/trade-in" style={link}>
              Trade-In Terms &amp; Conditions
            </a>
            . If you have any questions, reply to this email or contact us at
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
