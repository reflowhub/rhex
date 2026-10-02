import type { ReactNode } from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
  Img,
} from "@react-email/components";
import type { EmailBrand } from "@/lib/partner-config";

const TERMS_URL = "https://rhex.app/terms/trade-in";

interface TradeInLayoutProps {
  /**
   * Mode C partner brand (lib/partner-config.ts): the partner's logo in the
   * header and a standard footer with its support contact and "powered by
   * Reflow Hub". null for consumer emails: the "rhex" wordmark and `footer`.
   */
  brand: EmailBrand | null;
  /** Consumer emails only; co-branded emails use the standard footer */
  footer?: ReactNode;
  children: ReactNode;
}

/** Shared frame for trade-in customer emails. */
export default function TradeInLayout({ brand, footer, children }: TradeInLayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          {brand ? <BrandHeader brand={brand} /> : <Text style={heading}>rhex</Text>}
          {children}
          <Hr style={styles.hr} />
          {brand ? (
            <BrandFooter brand={brand} />
          ) : (
            <Text style={footerText}>{footer}</Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

function BrandHeader({ brand }: { brand: EmailBrand }) {
  if (!brand.logoUrl) return <Text style={heading}>{brand.name}</Text>;
  return (
    <Img src={brand.logoUrl} alt={brand.name} height="32" style={logo} />
  );
}

function BrandFooter({ brand }: { brand: EmailBrand }) {
  return (
    <>
      <Text style={footerText}>
        Questions? Reply to this email or contact us at{" "}
        <a href={`mailto:${brand.supportEmail}`} style={styles.link}>
          {brand.supportEmail}
        </a>
        {brand.supportPhone && <> or {brand.supportPhone}</>}. See our{" "}
        <a href={TERMS_URL} style={styles.link}>
          Trade-In Terms &amp; Conditions
        </a>
        .
      </Text>
      <Text style={poweredBy}>{brand.name} Trade-In, powered by Reflow Hub</Text>
    </>
  );
}

/** Styles shared by the trade-in templates. */
export const styles = {
  paragraph: {
    fontSize: "14px",
    lineHeight: "24px",
    color: "#374151",
  },
  callout: {
    backgroundColor: "#f3f4f6",
    borderRadius: "6px",
    padding: "12px 16px",
    margin: "16px 0",
  },
  calloutText: {
    fontSize: "15px",
    color: "#111827",
    margin: "0 0 4px",
  },
  calloutDetail: {
    fontSize: "13px",
    color: "#6b7280",
    margin: "0",
  },
  buttonSection: {
    textAlign: "center" as const,
    marginTop: "24px",
    marginBottom: "24px",
  },
  button: {
    backgroundColor: "#111827",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600" as const,
    padding: "12px 24px",
    borderRadius: "6px",
    textDecoration: "none",
  },
  hr: {
    borderColor: "#e5e7eb",
    margin: "24px 0",
  },
  link: {
    color: "#3b82f6",
    textDecoration: "underline",
  },
};

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

const logo = {
  height: "32px",
  width: "auto",
  maxWidth: "200px",
  marginBottom: "24px",
};

const footerText = {
  fontSize: "12px",
  color: "#9ca3af",
};

const poweredBy = {
  fontSize: "11px",
  color: "#9ca3af",
  margin: "0",
};
