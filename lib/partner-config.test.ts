import { describe, expect, it } from "vitest";
import { parseEmailList, parseOptionalEmail, parseResultWebhook } from "@/lib/partner-config";

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
