/**
 * Where a sandbox quote's customer emails go. Sandbox customers are test
 * data typed in by the partner, so an email only reaches the address given
 * if it's on the partner's allow-list; anything else is redirected to the
 * fallback inbox, or dropped when there is none. Pure; see lib/quote-email.ts.
 */

export interface SandboxEmailConfig {
  /** Exact addresses that may receive sandbox emails */
  allowlist: string[];
  /** Where every other sandbox email goes; null drops them */
  fallback: string | null;
}

export type SandboxRoute =
  | { to: string; redirectedFrom: null }
  | { to: string; redirectedFrom: string }
  | null;

export function routeSandboxEmail(
  to: string,
  config: SandboxEmailConfig
): SandboxRoute {
  const address = to.trim().toLowerCase();
  const allowed = config.allowlist.map((a) => a.trim().toLowerCase());
  if (allowed.includes(address)) return { to, redirectedFrom: null };
  return config.fallback ? { to: config.fallback, redirectedFrom: to } : null;
}

/** Read the sandbox email settings from a partner doc. */
export function sandboxEmailConfig(
  partner: Record<string, unknown> | undefined
): SandboxEmailConfig {
  const list = partner?.sandboxEmailAllowlist;
  const fallback = partner?.sandboxEmailFallback;
  return {
    allowlist: Array.isArray(list)
      ? list.filter((a): a is string => typeof a === "string" && a.trim() !== "")
      : [],
    fallback: typeof fallback === "string" && fallback.trim() ? fallback.trim() : null,
  };
}
