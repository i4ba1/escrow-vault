import { describe, expect, it } from "vitest";
import {
  buildStatusDistribution,
  buildTierOutcomes,
  countCertificates,
  countOpenRuns,
} from "@/lib/dashboard-stats";

describe("dashboard stat builders", () => {
  it("distributes deposit statuses preserving first-seen order", () => {
    expect(buildStatusDistribution(["ACTIVE", "DRAFT", "ACTIVE"])).toEqual({
      labels: ["ACTIVE", "DRAFT"],
      counts: [2, 1],
    });
    expect(buildStatusDistribution([])).toEqual({ labels: [], counts: [] });
  });

  it("counts terminal outcomes per tier, ignoring open runs", () => {
    const runs = [
      { tier: "VALIDATED", status: "PASSED" },
      { tier: "VALIDATED", status: "FAILED" },
      { tier: "VERIFIED", status: "QUEUED" },
      { tier: "CERTIFIED", status: "RUNNING" },
    ];
    expect(buildTierOutcomes(runs)).toEqual({
      tiers: ["VALIDATED", "VERIFIED", "CERTIFIED"],
      passed: [1, 0, 0],
      failed: [1, 0, 0],
    });
  });

  it("counts certificates and open runs", () => {
    const runs = [
      { tier: "VALIDATED", status: "PASSED", certificate: { serialNo: "CERT-1" } },
      { tier: "VERIFIED", status: "PASSED", certificate: null },
      { tier: "CERTIFIED", status: "RUNNING", certificate: null },
    ];
    expect(countCertificates(runs)).toBe(1);
    expect(countOpenRuns(runs)).toBe(1);
  });
});
