import { describe, expect, it } from "vitest";
import { routeSandboxEmail, sandboxEmailConfig } from "@/lib/sandbox-email";

const config = sandboxEmailConfig({
  sandboxEmailAllowlist: ["rex.zheng@oppomobile.com.au", "terence+oppo@reflowhub.com"],
  sandboxEmailFallback: "terence+oppo@reflowhub.com",
});

describe("routeSandboxEmail", () => {
  it("sends to allow-listed addresses (any case)", () => {
    expect(routeSandboxEmail("Rex.Zheng@oppomobile.com.au", config)).toEqual({
      to: "Rex.Zheng@oppomobile.com.au",
      redirectedFrom: null,
    });
  });

  it("redirects anything else to the fallback inbox", () => {
    expect(routeSandboxEmail("someone@gmail.com", config)).toEqual({
      to: "terence+oppo@reflowhub.com",
      redirectedFrom: "someone@gmail.com",
    });
  });

  it("drops the email when there's no fallback", () => {
    const strict = sandboxEmailConfig({ sandboxEmailAllowlist: ["a@b.co"] });
    expect(routeSandboxEmail("someone@gmail.com", strict)).toBeNull();
    expect(routeSandboxEmail("someone@gmail.com", sandboxEmailConfig(undefined))).toBeNull();
  });
});
