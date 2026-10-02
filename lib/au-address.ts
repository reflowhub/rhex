/**
 * Australian street addresses for trade-ins (AusPost labels and returns).
 * Client-safe. Quotes store the parts in `shippingAddressParts` and the
 * one-line form in `shippingAddress`, which emails and admin lists use.
 */

export const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

export type AuState = (typeof AU_STATES)[number];

export interface AuAddress {
  line1: string;
  line2: string | null;
  suburb: string;
  state: AuState;
  postcode: string;
}

/** Form state for the address fields (all strings, possibly empty). */
export interface AuAddressInput {
  line1: string;
  line2: string;
  suburb: string;
  state: string;
  postcode: string;
}

export const EMPTY_AU_ADDRESS: AuAddressInput = {
  line1: "",
  line2: "",
  suburb: "",
  state: "",
  postcode: "",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Validate submitted address parts. */
export function parseAuAddress(
  value: unknown
): { ok: true; address: AuAddress } | { ok: false; error: string } {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const line1 = text(v.line1);
  const line2 = text(v.line2);
  const suburb = text(v.suburb);
  const state = text(v.state).toUpperCase();
  const postcode = text(v.postcode).replace(/\s/g, "");

  if (!line1) return { ok: false, error: "Enter your street address" };
  if (!suburb) return { ok: false, error: "Enter your suburb" };
  if (!(AU_STATES as readonly string[]).includes(state)) {
    return { ok: false, error: "Choose your state" };
  }
  if (!/^\d{4}$/.test(postcode)) {
    return { ok: false, error: "Enter a 4-digit postcode" };
  }
  if ([line1, line2, suburb].some((s) => s.length > 100)) {
    return { ok: false, error: "Address lines must be 100 characters or fewer" };
  }

  return {
    ok: true,
    address: { line1, line2: line2 || null, suburb, state: state as AuState, postcode },
  };
}

/** Whether the form has everything parseAuAddress requires (for disabling submit). */
export function isAuAddressComplete(input: AuAddressInput): boolean {
  return parseAuAddress(input).ok;
}

/** "12 Smith St, Unit 2, Sydney NSW 2000" (lines in the order the AusPost portal takes them) */
export function formatAuAddress(a: AuAddress): string {
  const street = a.line2 ? `${a.line1}, ${a.line2}` : a.line1;
  return `${street}, ${a.suburb} ${a.state} ${a.postcode}`;
}

/** Form values from a stored address (blank when there is none). */
export function toAuAddressInput(value: unknown): AuAddressInput {
  const parsed = parseAuAddress(value);
  if (!parsed.ok) return { ...EMPTY_AU_ADDRESS };
  const a = parsed.address;
  return { line1: a.line1, line2: a.line2 ?? "", suburb: a.suburb, state: a.state, postcode: a.postcode };
}
