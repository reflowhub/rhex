import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUPPORT_EMAIL,
  customerEmailSwitches,
  emailBrandFor,
  parseCustomerEmails,
  parseEmailBrand,
  parseEmailList,
  parseOptionalEmail,
  parseResultWebhook,
  neverArrivedResultOn,
  parseNeverArrivedResult,
} from "@/lib/partner-config";

describe("parseResultWebhook", () => {
  it("accepts https templates with {quoteId} and env var names", () => {
    expect(
      parseResultWebhook({
        url: "https://omc.example/api/trade-in/{quoteId}",
        sandboxUrl: "https://omc-business-platform-staging.fly.dev/api/trade-in/{quoteId}",
        secretEnv: "TRADE_IN_WEBHOOK_SECRET",
        sandboxSecretEnv: "TRADE_IN_WEBHOOK_SECRET_SANDBOX",
      })
    ).toEqual({
      url: "https://omc.example/api/trade-in/{quoteId}",
      sandboxUrl: "https://omc-business-platform-staging.fly.dev/api/trade-in/{quoteId}",
      secretEnv: "TRADE_IN_WEBHOOK_SECRET",
      sandboxSecretEnv: "TRADE_IN_WEBHOOK_SECRET_SANDBOX",
    });
  });

  it("allows http only for localhost", () => {
    expect(parseResultWebhook({ sandboxUrl: "http://localhost:4010/api/trade-in/{quoteId}" }).sandboxUrl).toContain("localhost");
    expect(() => parseResultWebhook({ url: "http://omc.example/api/trade-in/{quoteId}" })).toThrow("https");
  });

  it("requires {quoteId} and a valid env var name", () => {
    expect(() => parseResultWebhook({ url: "https://omc.example/api/trade-in" })).toThrow("{quoteId}");
    expect(() => parseResultWebhook({ secretEnv: "the secret itself!" })).toThrow("env var");
  });

  it("treats blanks as unset", () => {
    expect(parseResultWebhook({ url: "", secretEnv: null })).toEqual({
      url: null,
      sandboxUrl: null,
      secretEnv: null,
      sandboxSecretEnv: null,
    });
  });
});

describe("email settings", () => {
  it("parses a list from lines or commas, lowercased and de-duplicated", () => {
    expect(parseEmailList("Rex.Zheng@oppomobile.com.au\nterence+oppo@reflowhub.com, rex.zheng@oppomobile.com.au")).toEqual([
      "rex.zheng@oppomobile.com.au",
      "terence+oppo@reflowhub.com",
    ]);
    expect(() => parseEmailList("nope")).toThrow("nope");
  });

  it("parses an optional single address", () => {
    expect(parseOptionalEmail("", "Inbox")).toBeNull();
    expect(parseOptionalEmail("Terence+oppo@reflowhub.com", "Inbox")).toBe("terence+oppo@reflowhub.com");
    expect(() => parseOptionalEmail("x", "Inbox")).toThrow("Inbox");
  });
});

describe("customer email brand", () => {
  it("parses brand settings, blanks as unset", () => {
    expect(
      parseEmailBrand({
        displayName: " OPPO ",
        logoUrl: "https://cdn.shopify.com/s/files/oppo-logo.png?v=3",
        supportEmail: "Support@ReflowHub.com",
        supportPhone: "",
      })
    ).toEqual({
      displayName: "OPPO",
      logoUrl: "https://cdn.shopify.com/s/files/oppo-logo.png?v=3",
      supportEmail: "support@reflowhub.com",
      supportPhone: null,
    });
    expect(parseEmailBrand(undefined)).toEqual({
      displayName: null,
      logoUrl: null,
      supportEmail: null,
      supportPhone: null,
    });
  });

  it("requires an https PNG logo and a phone-shaped phone", () => {
    expect(() => parseEmailBrand({ logoUrl: "http://oppo.example/logo.png" })).toThrow("https");
    expect(() => parseEmailBrand({ logoUrl: "https://oppo.example/logo.svg" })).toThrow("PNG");
    expect(() => parseEmailBrand({ supportEmail: "nope" })).toThrow("Support email");
    expect(parseEmailBrand({ supportPhone: "+61 2 9000 0000" }).supportPhone).toBe("+61 2 9000 0000");
    expect(() => parseEmailBrand({ supportPhone: "call us" })).toThrow("phone");
  });

  it("fills defaults from the partner when the email is sent", () => {
    expect(emailBrandFor({ name: "OPPO AU" })).toEqual({
      name: "OPPO AU",
      logoUrl: null,
      supportEmail: DEFAULT_SUPPORT_EMAIL,
      supportPhone: null,
    });
    expect(emailBrandFor({ name: "OPPO AU", emailBrand: { displayName: "OPPO" } }).name).toBe("OPPO");
  });
});

describe("customer email switches", () => {
  it("are all on unless switched off", () => {
    expect(Object.values(customerEmailSwitches(undefined)).every(Boolean)).toBe(true);
    const s = customerEmailSwitches({ customerEmails: { label: false, accepted: true } });
    expect(s.label).toBe(false);
    expect(s.accepted).toBe(true);
    expect(s.received).toBe(true);
  });

  it("accept only known switches with on/off values", () => {
    expect(parseCustomerEmails({ approved: false }).approved).toBe(false);
    // Re-quote emails can't be switched off
    expect(() => parseCustomerEmails({ revised: false })).toThrow("revised");
    expect(() => parseCustomerEmails({ label: "no" })).toThrow("on or off");
    expect(() => parseCustomerEmails(null)).toThrow();
  });
});

describe("never-arrived result setting", () => {
  it("is on unless switched off", () => {
    expect(neverArrivedResultOn(undefined)).toBe(true);
    expect(neverArrivedResultOn({})).toBe(true);
    expect(neverArrivedResultOn({ neverArrivedResult: true })).toBe(true);
    expect(neverArrivedResultOn({ neverArrivedResult: false })).toBe(false);
  });

  it("must be on or off", () => {
    expect(parseNeverArrivedResult(false)).toBe(false);
    expect(() => parseNeverArrivedResult("no")).toThrow("on or off");
  });
});
