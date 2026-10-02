import { describe, expect, it } from "vitest";
import { formatTimeLeft } from "@/lib/quote-validity";

const NOW = new Date("2026-10-02T00:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe("formatTimeLeft", () => {
  it("uses days from 2 days, hours from 1 hour, then minutes", () => {
    expect(formatTimeLeft(at(14 * 24 * HOUR), NOW)).toBe("14 days");
    expect(formatTimeLeft(at(47 * HOUR), NOW)).toBe("47 hours");
    expect(formatTimeLeft(at(24 * HOUR), NOW)).toBe("24 hours");
    expect(formatTimeLeft(at(HOUR), NOW)).toBe("1 hour");
    expect(formatTimeLeft(at(59 * MIN), NOW)).toBe("59 minutes");
    expect(formatTimeLeft(at(10 * 1000), NOW)).toBe("1 minute");
  });

  it("accepts ISO strings", () => {
    expect(formatTimeLeft(at(3 * HOUR).toISOString(), NOW)).toBe("3 hours");
  });
});
