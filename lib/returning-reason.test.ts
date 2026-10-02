import { describe, expect, it } from "vitest";
import { returningReason } from "./returning-reason";

describe("returningReason", () => {
  it("is expired when the re-quote ran out", () => {
    expect(returningReason({ revisionAutoExpired: true })).toBe("expired");
  });

  it("is declined when the customer rejected the re-quote", () => {
    expect(returningReason({ revisionRejectedAt: "2026-10-03T00:00:00.000Z" })).toBe("declined");
  });

  it("is rejected when RHEX returns the device without a re-quote answer", () => {
    expect(returningReason({})).toBe("rejected");
  });
});
