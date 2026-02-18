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

interface OrderItem {
  description: string;
  priceAUD: number;
}

interface OrderConfirmedEmailProps {
  customerName: string;
  orderNumber: string;
  orderId: string;
  items: OrderItem[];
  totalAUD: number;
}

export default function OrderConfirmedEmail({
  customerName,
  orderNumber,
  orderId,
  items,
  totalAUD,
}: OrderConfirmedEmailProps) {
  const orderUrl = `https://rhex.app/buy/order/${orderId}`;

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>rhex</Text>
          <Text style={paragraph}>Hi {customerName},</Text>
          <Text style={paragraph}>
            Your order <strong>#{orderNumber}</strong> has been confirmed. We're
            preparing your items for shipment.
          </Text>
          <Section style={itemsSection}>
            {items.map((item, i) => (
              <Text key={i} style={itemRow}>
                {item.description} — ${item.priceAUD.toFixed(2)} AUD
              </Text>
            ))}
            <Hr style={hr} />
            <Text style={totalRow}>
              Total: ${totalAUD.toFixed(2)} AUD
            </Text>
          </Section>
          <Section style={buttonSection}>
            <Button style={button} href={orderUrl}>
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

const itemsSection = {
  backgroundColor: "#f9fafb",
  padding: "16px",
  borderRadius: "6px",
  marginTop: "16px",
  marginBottom: "16px",
};

const itemRow = {
  fontSize: "14px",
  color: "#374151",
  margin: "4px 0",
};

const totalRow = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#111827",
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
  margin: "16px 0",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
};
