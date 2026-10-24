// Pure builders behind the portal dashboard charts. Kept free of React and
// data-fetching so they unit-test without a browser or database; the client
// component in (portal)/dashboard.client.tsx only wires them to useQuery.
export const TIERS = ["VALIDATED", "VERIFIED", "CERTIFIED"] as const;

export interface RunPoint {
  tier: string;
  status: string;
  certificate: unknown;
}

export function buildStatusDistribution(statuses: string[]): {
  labels: string[];
  counts: number[];
} {
  const labels = [...new Set(statuses)];
  return {
    labels,
    counts: labels.map((s) => statuses.filter((x) => x === s).length),
  };
}

export function buildTierOutcomes(runs: Pick<RunPoint, "tier" | "status">[]): {
  tiers: string[];
  passed: number[];
  failed: number[];
} {
  return {
    tiers: [...TIERS],
    passed: TIERS.map(
      (t) => runs.filter((r) => r.tier === t && r.status === "PASSED").length,
    ),
    failed: TIERS.map(
      (t) => runs.filter((r) => r.tier === t && r.status === "FAILED").length,
    ),
  };
}

export function countCertificates(runs: RunPoint[]): number {
  return runs.filter((r) => r.certificate != null).length;
}

export function countOpenRuns(runs: Pick<RunPoint, "status">[]): number {
  return runs.filter((r) => r.status === "QUEUED" || r.status === "RUNNING")
    .length;
}
