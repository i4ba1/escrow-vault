import { describe, expect, it } from "vitest";
import { VerificationTier } from "@prisma/client";
import { nextTier } from "@/services/verification";

describe("nextTier", () => {
  it("starts unvalidated deposits at VALIDATED", () => {
    expect(nextTier([])).toBe(VerificationTier.VALIDATED);
  });

  it("walks the ladder without skipping", () => {
    expect(nextTier([VerificationTier.VALIDATED])).toBe(VerificationTier.VERIFIED);
    expect(nextTier([VerificationTier.VALIDATED, VerificationTier.VERIFIED])).toBe(
      VerificationTier.CERTIFIED,
    );
  });

  it("returns null once every tier passed", () => {
    expect(
      nextTier([
        VerificationTier.VALIDATED,
        VerificationTier.VERIFIED,
        VerificationTier.CERTIFIED,
      ]),
    ).toBeNull();
  });
});
