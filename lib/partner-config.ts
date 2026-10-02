/**
 * Validation for partner settings edited in admin (Mode C result webhook,
 * sandbox email routing). Client-safe.
 */

export const PARTNER_MODES = ["A", "B", "C"] as const;
export type PartnerMode = (typeof PARTNER_MODES)[number];

export interface ResultWebhookConfig {
  /** Production result URL template with {quoteId} */
  url: string | null;
  /** Sandbox (partner staging) result URL template with {quoteId} */
  sandboxUrl: string | null;
  /** Env var holding the production signing secret */
  secretEnv: string | null;
  /** Env var holding the sandbox signing secret */
  sandboxSecretEnv: string | null;
}

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

function urlTemplate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} must be a URL`);
  const v = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(v.replace("{quoteId}", "QUOTE"));
  } catch {
    throw new Error(`${field} must be a URL`);
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !local) {
    throw new Error(`${field} must use https`);
  }
  if (!v.includes("{quoteId}")) {
    throw new Error(`${field} must contain {quoteId} where the quote ID goes`);
  }
  return v;
}

function envName(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !ENV_NAME.test(value.trim())) {
    throw new Error(`${field} must be an env var name like TRADE_IN_WEBHOOK_SECRET`);
  }
  return value.trim();
}

/** Parse the result webhook settings; throws with a message for the admin. */
export function parseResultWebhook(value: unknown): ResultWebhookConfig {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    url: urlTemplate(v.url, "Result URL"),
    sandboxUrl: urlTemplate(v.sandboxUrl, "Sandbox result URL"),
    secretEnv: envName(v.secretEnv, "Secret env var"),
    sandboxSecretEnv: envName(v.sandboxSecretEnv, "Sandbox secret env var"),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Addresses from a list or a comma/newline-separated string; throws on a bad one. */
export function parseEmailList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : [];
  const emails = items
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const bad = emails.find((e) => !EMAIL.test(e));
  if (bad) throw new Error(`"${bad}" isn't a valid email address`);
  return Array.from(new Set(emails));
}

export function parseOptionalEmail(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !EMAIL.test(value.trim())) {
    throw new Error(`${field} isn't a valid email address`);
  }
  return value.trim().toLowerCase();
}
