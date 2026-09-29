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

interface PartnerPasswordResetEmailProps {
  partnerName: string;
  resetLink: string;
}

export default function PartnerPasswordResetEmail({
  partnerName,
  resetLink,
}: PartnerPasswordResetEmailProps) {
  const loginUrl = "https://rhex.app/partner/login";

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {partnerName},</Text>
          <Text style={paragraph}>
            We received a request to reset the password for your rhex partner
            account. Click the button below to choose a new password. This link
            expires in 1 hour.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={resetLink}>
              Reset Password
            </Button>
          </Section>
          <Text style={paragraph}>
            Once you&apos;ve set a new password, sign in at{" "}
            <a href={loginUrl} style={link}>
              rhex.app/partner/login
            </a>
            .
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t ask to reset your password, you can safely
            ignore this email. Your password won&apos;t change.
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
