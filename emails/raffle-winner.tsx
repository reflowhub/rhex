import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
} from "@react-email/components";

interface RaffleWinnerEmailProps {
  customerName: string;
  raffleMonth: string; // e.g. "February 2026"
}

export default function RaffleWinnerEmail({
  customerName,
  raffleMonth,
}: RaffleWinnerEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            Congratulations! You've been drawn as the winner of our{" "}
            <strong>{raffleMonth}</strong> feedback raffle!
          </Text>
          <Text style={paragraph}>
            Reply to this email to claim your prize.
          </Text>
          <Text style={paragraph}>
            Thank you for sharing your feedback with us!
          </Text>
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

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};
