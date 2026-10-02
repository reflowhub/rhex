import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
} from "@react-email/components";

interface OpsAlertEmailProps {
  title: string;
  details: { label: string; value: string }[];
  actionUrl?: string;
  actionLabel?: string;
}

/** Internal alert for the RHEX team (OPS_ALERT_EMAIL), e.g. a failed partner result. */
export default function OpsAlertEmail({
  title,
  details,
  actionUrl,
  actionLabel = "Open in admin",
}: OpsAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>{title}</Text>
          {details.map((d) => (
            <Text key={d.label} style={detail}>
              <strong>{d.label}:</strong> {d.value}
            </Text>
          ))}
          {actionUrl && (
            <Button style={button} href={actionUrl}>
              {actionLabel}
            </Button>
          )}
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
  maxWidth: "520px",
};

const heading = {
  fontSize: "18px",
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: "16px",
};

const detail = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#374151",
  margin: "4px 0",
};

const button = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  padding: "10px 16px",
  marginTop: "16px",
};
