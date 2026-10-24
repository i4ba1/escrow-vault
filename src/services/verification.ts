import { prisma } from "../lib/prisma";
import { logEvent } from "./audit";
import {
  ConflictError,
  ForbiddenError,
  InputError,
  NotFoundError,
} from "./errors";
import { Role, type Actor } from "./types";
import {
  VerificationStatus,
  VerificationTier,
  type Prisma,
} from "@prisma/client";

export type RunWithRelations = Prisma.VerificationRunGetPayload<{
  include: {
    certificate: true;
    deposit: { include: { agreement: true; assets: true } };
  };
}>;

const TIER_ORDER = [
  VerificationTier.VALIDATED,
  VerificationTier.VERIFIED,
  VerificationTier.CERTIFIED,
] as const;

// Plain type (not interface): only object-literal types get an implicit index
// signature, which Prisma's InputJsonValue requires for JSON columns.
type Check = {
  name: string;
  pass: boolean;
  detail: string;
};

function summarize(checks: Check[]): { passed: boolean; checks: Check[] } {
  return { passed: checks.every((c) => c.pass), checks };
}

export async function listVerificationRuns(
  tenantId: string,
  statuses?: VerificationStatus[],
): Promise<RunWithRelations[]> {
  return prisma.verificationRun.findMany({
    where: {
      deposit: { agreement: { tenantId } },
      ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
    },
    include: {
      certificate: true,
      deposit: { include: { agreement: true, assets: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRunDetail(
  tenantId: string,
  runId: string,
): Promise<RunWithRelations> {
  const run = await prisma.verificationRun.findFirst({
    where: { id: runId, deposit: { agreement: { tenantId } } },
    include: {
      certificate: true,
      deposit: { include: { agreement: true, assets: true } },
    },
  });
  if (!run) {
    throw new NotFoundError("Verification run not found in this tenant.");
  }
  return run;
}

export function nextTier(
  passedTiers: VerificationTier[],
): VerificationTier | null {
  for (const tier of TIER_ORDER) {
    if (!passedTiers.includes(tier)) return tier;
  }
  return null;
}

// Agent escalates a deposit to the next tier. Requires the previous tier
// PASSED (no skipping) and no open run of the requested tier.
export async function escalateRun(
  actor: Actor,
  depositId: string,
  tier: VerificationTier,
): Promise<RunWithRelations> {
  if (actor.role !== Role.AGENT) {
    throw new ForbiddenError("Only escrow agents manage verification.");
  }
  if (!TIER_ORDER.includes(tier)) {
    throw new InputError(`Unknown tier: ${String(tier)}.`);
  }
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, agreement: { tenantId: actor.tenantId } },
    include: {
      verificationRuns: { select: { tier: true, status: true } },
    },
  });
  if (!deposit) {
    throw new NotFoundError("Deposit not found in this tenant.");
  }
  const passed = deposit.verificationRuns
    .filter((r) => r.status === VerificationStatus.PASSED)
    .map((r) => r.tier);
  if (nextTier(passed) !== tier) {
    throw new ConflictError(
      `Cannot open ${tier}: complete the ${nextTier(passed) ?? "outstanding"} tier first.`,
    );
  }
  const open = deposit.verificationRuns.some(
    (r) =>
      r.tier === tier &&
      (r.status === VerificationStatus.QUEUED ||
        r.status === VerificationStatus.RUNNING),
  );
  if (open) {
    throw new ConflictError(`A ${tier} run is already open for this deposit.`);
  }
  const run = await prisma.verificationRun.create({
    data: { depositId, tier, status: VerificationStatus.QUEUED },
    include: {
      certificate: true,
      deposit: { include: { agreement: true, assets: true } },
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "VerificationRun",
    entityId: run.id,
    action: "QUEUED",
    diff: { tier },
    depositId,
    verificationRunId: run.id,
  });
  return run;
}

async function issueCertificate(
  tenantId: string,
  actorId: string | null,
  runId: string,
  tier: VerificationTier,
  depositId: string,
) {
  const year = new Date().getUTCFullYear();
  const count = await prisma.certificate.count({
    where: {
      issuedAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  });
  const serialNo = `CERT-${year}-${String(count + 1).padStart(4, "0")}`;
  const certificate = await prisma.certificate.create({
    data: { verificationRunId: runId, tier, serialNo },
  });
  await logEvent({
    tenantId,
    actorId: actorId ?? undefined,
    entity: "Certificate",
    entityId: certificate.id,
    action: "ISSUED",
    diff: { serialNo, tier },
    depositId,
    verificationRunId: runId,
  });
  return certificate;
}

async function finishRun(
  run: RunWithRelations,
  tenantId: string,
  actorId: string | null,
  passed: boolean,
  summary: { passed: boolean; checks: Check[] },
): Promise<RunWithRelations> {
  const updated = await prisma.verificationRun.update({
    where: { id: run.id },
    data: {
      status: passed ? VerificationStatus.PASSED : VerificationStatus.FAILED,
      findings: summary as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
    include: {
      certificate: true,
      deposit: { include: { agreement: true, assets: true } },
    },
  });
  await logEvent({
    tenantId,
    actorId: actorId ?? undefined,
    entity: "VerificationRun",
    entityId: run.id,
    action: passed ? "PASSED" : "FAILED",
    diff: { tier: run.tier, checks: summary.checks },
    depositId: run.depositId,
    verificationRunId: run.id,
  });
  if (passed) {
    await issueCertificate(tenantId, actorId, run.id, run.tier, run.depositId);
    return getRunDetail(tenantId, run.id);
  }
  return updated;
}

// Validated: deposit is complete, intact and covered — hashes verified by the
// scan, a source asset present, at least one supporting asset type.
function validatedChecks(run: RunWithRelations): Check[] {
  const assets = run.deposit.assets;
  const types = new Set(assets.map((a) => a.type));
  return [
    {
      name: "scan-clean",
      pass: assets.length > 0 && assets.every((a) => a.scanStatus === "PASS"),
      detail: `${assets.filter((a) => a.scanStatus === "PASS").length}/${assets.length} assets scan PASS`,
    },
    {
      name: "source-present",
      pass: types.has("SOURCE"),
      detail: types.has("SOURCE")
        ? "source archive deposited"
        : "no SOURCE asset — nothing to rebuild from",
    },
    {
      name: "supporting-coverage",
      pass: assets.length >= 2 && types.size >= 2,
      detail: `${assets.length} asset(s) across ${types.size} type(s)`,
    },
  ];
}

// Verified: Validated plus content profiling and cross-version drift — a new
// version that drops assets versus its predecessor fails (escrow regression).
async function verifiedChecks(run: RunWithRelations): Promise<Check[]> {
  const checks = validatedChecks(run);
  const assets = run.deposit.assets;
  const totalBytes = assets.reduce((n, a) => n + Number(a.sizeBytes), 0);
  const byType = Object.fromEntries(
    [...new Set(assets.map((a) => a.type))].map((t) => [
      t,
      {
        count: assets.filter((a) => a.type === t).length,
        bytes: assets
          .filter((a) => a.type === t)
          .reduce((n, a) => n + Number(a.sizeBytes), 0),
      },
    ]),
  );
  checks.push({
    name: "content-profile",
    pass: totalBytes > 0,
    detail: `${assets.length} asset(s), ${totalBytes} bytes, profile: ${JSON.stringify(byType)}`,
  });

  const prev = await prisma.deposit.findFirst({
    where: {
      agreementId: run.deposit.agreementId,
      version: run.deposit.version - 1,
    },
    include: { assets: { select: { id: true } } },
  });
  if (prev) {
    const dropped = prev.assets.length - assets.length;
    checks.push({
      name: "no-asset-regression",
      pass: dropped <= 0,
      detail:
        dropped <= 0
          ? `v${run.deposit.version} keeps all ${prev.assets.length} prior asset(s)`
          : `v${run.deposit.version} drops ${dropped} asset(s) vs v${prev.version}`,
    });
  } else {
    checks.push({
      name: "no-asset-regression",
      pass: true,
      detail: "first version — nothing to regress against",
    });
  }
  return checks;
}

// Certified: Verified plus a reproducible-build gate (a build script must be
// deposited) and a mandatory human sign-off — the run stays RUNNING until an
// agent approves or rejects it via decideCertifiedRun().
async function certifiedPreChecks(run: RunWithRelations): Promise<Check[]> {
  const checks = await verifiedChecks(run);
  const types = new Set(run.deposit.assets.map((a) => a.type));
  checks.push({
    name: "build-reproducible",
    pass: types.has("BUILD_SCRIPT"),
    detail: types.has("BUILD_SCRIPT")
      ? "build script deposited — rebuild is describable"
      : "no BUILD_SCRIPT asset — a human cannot reproduce the build",
  });
  return checks;
}

// Executes one QUEUED run. Automated tiers finish terminally; CERTIFIED parks
// in RUNNING for the human build-test sign-off. Returns the refreshed run.
export async function executeRun(
  tenantId: string,
  runId: string,
  actorId: string | null,
): Promise<RunWithRelations> {
  const run = await getRunDetail(tenantId, runId);
  if (run.status !== VerificationStatus.QUEUED) {
    throw new ConflictError(`Run is ${run.status}; only QUEUED runs execute.`);
  }
  await prisma.verificationRun.update({
    where: { id: run.id },
    data: { status: VerificationStatus.RUNNING },
  });
  await logEvent({
    tenantId,
    actorId: actorId ?? undefined,
    entity: "VerificationRun",
    entityId: run.id,
    action: "RUNNING",
    diff: { tier: run.tier },
    depositId: run.depositId,
    verificationRunId: run.id,
  });

  if (run.tier === VerificationTier.VALIDATED) {
    const summary = summarize(validatedChecks(run));
    return finishRun(run, tenantId, actorId, summary.passed, summary);
  }
  if (run.tier === VerificationTier.VERIFIED) {
    const summary = summarize(await verifiedChecks(run));
    return finishRun(run, tenantId, actorId, summary.passed, summary);
  }
  // CERTIFIED: automated pre-checks must pass before a human is even asked.
  const summary = summarize(await certifiedPreChecks(run));
  if (!summary.passed) {
    return finishRun(run, tenantId, actorId, false, summary);
  }
  await prisma.verificationRun.update({
    where: { id: run.id },
    data: { findings: summary as unknown as Prisma.InputJsonValue },
  });
  await logEvent({
    tenantId,
    actorId: actorId ?? undefined,
    entity: "VerificationRun",
    entityId: run.id,
    action: "AWAITING_HUMAN_REVIEW",
    diff: { tier: run.tier, checks: summary.checks },
    depositId: run.depositId,
    verificationRunId: run.id,
  });
  return getRunDetail(tenantId, run.id);
}

// Human build-test verdict for a CERTIFIED run parked in RUNNING.
export async function decideCertifiedRun(
  actor: Actor,
  runId: string,
  approve: boolean,
  note: string,
): Promise<RunWithRelations> {
  if (actor.role !== Role.AGENT) {
    throw new ForbiddenError("Only escrow agents sign off certified builds.");
  }
  const run = await getRunDetail(actor.tenantId, runId);
  if (run.tier !== VerificationTier.CERTIFIED) {
    throw new InputError("Human sign-off applies to CERTIFIED runs only.");
  }
  if (run.status !== VerificationStatus.RUNNING) {
    throw new ConflictError(`Run is ${run.status}; nothing to decide.`);
  }
  const prior =
    (run.findings as { checks?: Check[] } | null)?.checks ?? [];
  const summary = summarize([
    ...prior,
    {
      name: "human-build-test",
      pass: approve,
      detail: note.slice(0, 500) || "(no note)",
    },
  ]);
  return finishRun(run, actor.tenantId, actor.userId, summary.passed, summary);
}

// System pass over every QUEUED run (scan worker / scheduled job). No actor:
// audit entries record a null actor for automated transitions.
export async function executeQueuedRuns(): Promise<{
  executed: number;
  passed: number;
  failed: number;
  awaitingReview: number;
}> {
  const queued = await prisma.verificationRun.findMany({
    where: { status: VerificationStatus.QUEUED },
    include: {
      certificate: true,
      deposit: { include: { agreement: true, assets: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const result = { executed: 0, passed: 0, failed: 0, awaitingReview: 0 };
  for (const run of queued) {
    const tenantId = run.deposit.agreement.tenantId;
    const done = await executeRun(tenantId, run.id, null);
    result.executed += 1;
    if (done.status === VerificationStatus.PASSED) result.passed += 1;
    else if (done.status === VerificationStatus.FAILED) result.failed += 1;
    else result.awaitingReview += 1;
  }
  return result;
}
