import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
} from "@react-email/components";

interface PartnerPayoutDetailsChangedEmailProps {
  partnerName: string;
  changes: { label: string; value: string }[];
  changedAt: string;
}

export default function PartnerPayoutDetailsChangedEmail({
  partnerName,
  changes,
  changedAt,
}: PartnerPayoutDetailsChangedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {partnerName},</Text>
          <Text style={paragraph}>
            The payout details on your rhex partner account were changed on{" "}
            {changedAt}. Future payouts will go to:
          </Text>
          {changes.map((change) => (
            <Text key={change.label} style={detail}>
              <strong>{change.label}:</strong> {change.value}
            </Text>
          ))}
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t make this change, contact the rhex team straight
            away so we can secure your account and hold any payouts.
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

const detail = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#374151",
  margin: "4px 0",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};
