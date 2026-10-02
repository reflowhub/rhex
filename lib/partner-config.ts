/**
 * Validation for partner settings edited in admin (Mode C result webhook,
 * sandbox email routing, customer email brand and switches). Client-safe.
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

// ---------------------------------------------------------------------------
// Mode C customer emails: brand and switches (docs/partners/OPPO.md, 2b)
// ---------------------------------------------------------------------------

/** Support contact and reply-to when the partner has none set. */
export const DEFAULT_SUPPORT_EMAIL = "support@reflowhub.com";

/** Brand settings as stored on the partner (`emailBrand`); blanks are null. */
export interface EmailBrandSettings {
  /** Name used in the emails; the partner's name when unset */
  displayName: string | null;
  /** https PNG shown in the email header */
  logoUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
}

/** What a co-branded email shows, with defaults filled in. */
export interface EmailBrand {
  name: string;
  logoUrl: string | null;
  supportEmail: string;
  supportPhone: string | null;
}

/**
 * Customer emails a Mode C partner can switch off, e.g. when it sends that
 * email itself. All on by default. Re-quote emails and the re-quote
 * reminder aren't listed: only RHEX can send those, so they always go.
 */
export const CUSTOMER_EMAIL_SWITCHES = [
  { key: "accepted", label: "Trade-in accepted" },
  { key: "label", label: "Shipping label" },
  { key: "labelReminders", label: "Label reminders (day 7 and 12)" },
  { key: "received", label: "Device received" },
  { key: "approved", label: "Approved (refund wording)" },
  { key: "returning", label: "Returning the device (declined, expired or rejected)" },
  { key: "returned", label: "Device posted back (tracking)" },
  { key: "closed", label: "Closed, never posted" },
] as const;

export type CustomerEmailSwitch = (typeof CUSTOMER_EMAIL_SWITCHES)[number]["key"];

const SWITCH_KEYS: readonly string[] = CUSTOMER_EMAIL_SWITCHES.map((s) => s.key);

export function isCustomerEmailSwitch(key: string): key is CustomerEmailSwitch {
  return SWITCH_KEYS.includes(key);
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const v = value.trim();
  if (v.length > max) throw new Error(`${field} must be at most ${max} characters`);
  return v || null;
}

function logoUrl(value: unknown): string | null {
  const v = optionalText(value, "Email logo URL", 500);
  if (!v) return null;
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    throw new Error("Email logo URL must be a URL");
  }
  if (parsed.protocol !== "https:") throw new Error("Email logo URL must use https");
  // Email clients don't all show SVG or WebP
  if (!parsed.pathname.toLowerCase().endsWith(".png")) {
    throw new Error("Email logo URL must be a PNG (ending in .png)");
  }
  return v;
}

const PHONE = /^\+?[0-9 ()-]{6,20}$/;

/** Parse the email brand settings; throws with a message for the admin. */
export function parseEmailBrand(value: unknown): EmailBrandSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const supportPhone = optionalText(v.supportPhone, "Support phone", 20);
  if (supportPhone && !PHONE.test(supportPhone)) {
    throw new Error("Support phone must be a phone number");
  }
  return {
    displayName: optionalText(v.displayName, "Email display name", 60),
    logoUrl: logoUrl(v.logoUrl),
    supportEmail: parseOptionalEmail(v.supportEmail, "Support email"),
    supportPhone,
  };
}

/** The email brand for a partner doc, with defaults. */
export function emailBrandFor(partner: Record<string, unknown> | undefined): EmailBrand {
  const raw = (partner?.emailBrand ?? {}) as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  return {
    name: text(raw.displayName) ?? text(partner?.name) ?? "Reflow Hub",
    logoUrl: text(raw.logoUrl),
    supportEmail: text(raw.supportEmail) ?? DEFAULT_SUPPORT_EMAIL,
    supportPhone: text(raw.supportPhone),
  };
}

/** Every switch, read from a partner doc's `customerEmails`; unset means on. */
export function customerEmailSwitches(
  partner: Record<string, unknown> | undefined
): Record<CustomerEmailSwitch, boolean> {
  const raw = (partner?.customerEmails ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    CUSTOMER_EMAIL_SWITCHES.map(({ key }) => [key, raw[key] !== false])
  ) as Record<CustomerEmailSwitch, boolean>;
}

/** Parse the switches sent by admin: booleans for known keys only. */
export function parseCustomerEmails(value: unknown): Record<CustomerEmailSwitch, boolean> {
  if (!value || typeof value !== "object") throw new Error("Customer emails must be a set of switches");
  const v = value as Record<string, unknown>;
  const unknown = Object.keys(v).find((k) => !isCustomerEmailSwitch(k));
  if (unknown) throw new Error(`"${unknown}" isn't a customer email that can be switched off`);
  const bad = Object.entries(v).find(([, on]) => typeof on !== "boolean");
  if (bad) throw new Error(`Customer email "${bad[0]}" must be on or off`);
  return customerEmailSwitches({ customerEmails: v });
}
