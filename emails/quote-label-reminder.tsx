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

interface QuoteLabelReminderEmailProps {
  customerName: string;
  deviceName: string;
  tradeInRef: string;
  postBy: string;
  quoteId: string;
  /** The last reminder before postBy */
  final: boolean;
}

/** Day-7 and day-12 reminders to post the device (docs/TRADEIN-STATES-PLAN.md §3). */
export default function QuoteLabelReminderEmail({
  customerName,
  deviceName,
  tradeInRef,
  postBy,
  quoteId,
  final,
}: QuoteLabelReminderEmailProps) {
  const quoteUrl = `https://rhex.app/sell/quote/${quoteId}`;

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            {final
              ? "Just a final reminder: "
              : "A quick reminder: "}
            your <strong>{deviceName}</strong> (trade-in{" "}
            <strong>{tradeInRef}</strong>) needs to be posted with the prepaid
            label we sent you.
          </Text>

          <Section style={callout}>
            <Text style={calloutText}>
              Post by <strong>{postBy}</strong>.
            </Text>
            <Text style={calloutDetail}>
              Drop it at any Australia Post outlet or street posting box.
            </Text>
          </Section>

          <Text style={paragraph}>
            Pack it in a rigid box with padding, and put a note inside with
            your reference <strong>{tradeInRef}</strong>. You can download your
            label again from your trade-in page.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={quoteUrl}>
              View Your Trade-In
            </Button>
          </Section>
          <Text style={paragraph}>
            Already posted it? Let us know from your trade-in page and we&apos;ll
            stop these reminders.
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
