// M4 smoke test (no Auth0 needed): the full verification lifecycle —
// scan-queued Validated run executes to PASSED + certificate, escalation
// through VERIFIED, CERTIFIED parking in RUNNING, human sign-off, plus RBAC
// and tenant-isolation checks. Cleans up after itself.
// Run: pnpm smoke:m4 (DATABASE_URL + S3_* come from .env via --env-file).
import { createHash, randomBytes } from "node:crypto";
import { Role, VerificationStatus, VerificationTier } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { createDraftDeposit } from "../../src/services/deposits";
import { requestUploadUrl } from "../../src/services/uploads";
import { scanPendingAssets } from "../../src/services/scan";
import {
  decideCertifiedRun,
  escalateRun,
  executeQueuedRuns,
  executeRun,
  getRunDetail,
} from "../../src/services/verification";
import type { Actor } from "../../src/services/types";

let failures = 0;

function check(name: string, condition: unknown, extra?: unknown): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}`, extra ?? "");
  }
}

function codeOf(error: unknown): string {
  return (error as { code?: string } | null)?.code ?? "(no code)";
}

async function uploadAsset(
  actor: Actor,
  depositId: string,
  filename: string,
  assetType: string,
  bytes: number,
): Promise<void> {
  const payload = randomBytes(bytes);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const signed = await requestUploadUrl({
    ...actor,
    depositId,
    filename,
    assetType,
    sizeBytes: payload.byteLength,
    sha256,
  });
  const put = await fetch(signed.url, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: new Blob([payload.buffer as ArrayBuffer]),
  });
  if (put.status !== 200) throw new Error(`PUT failed: ${put.status}`);
}

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" } });
  const users = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  const byRole = Object.fromEntries(users.map((u) => [u.role, u])) as Record<Role, (typeof users)[number]>;
  const depositor: Actor = { tenantId: tenant.id, userId: byRole.DEPOSITOR.id, role: Role.DEPOSITOR };
  const agent: Actor = { tenantId: tenant.id, userId: byRole.AGENT.id, role: Role.AGENT };

  const agreement = await prisma.agreement.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const draft = await createDraftDeposit(depositor, agreement.id);
  // Three types so the coverage check has something to chew on (and the
  // Certified build-reproducibility gate sees a build script).
  await uploadAsset(depositor, draft.id, "smoke-app.tar.gz", "SOURCE", 32 * 1024);
  await uploadAsset(depositor, draft.id, "smoke-build.sh", "BUILD_SCRIPT", 1024);
  await uploadAsset(depositor, draft.id, "smoke-readme.md", "DOCS", 2048);
  await scanPendingAssets();

  console.log("Validated tier (automated):");
  const exec1 = await executeQueuedRuns();
  check("one run executed to PASSED", exec1.executed === 1 && exec1.passed === 1, exec1);
  const runV = await prisma.verificationRun.findFirstOrThrow({
    where: { depositId: draft.id, tier: VerificationTier.VALIDATED },
    include: { certificate: true },
  });
  check("run PASSED", runV.status === VerificationStatus.PASSED, runV.status);
  check(
    "certificate serial format CERT-YYYY-NNNN",
    /^CERT-\d{4}-\d{4}$/.test(runV.certificate?.serialNo ?? ""),
    runV.certificate?.serialNo,
  );

  console.log("Escalation + Verified tier:");
  try {
    await escalateRun(depositor, draft.id, VerificationTier.VERIFIED);
    check("depositor escalation rejected", false);
  } catch (e) {
    check("depositor escalation rejected with FORBIDDEN", codeOf(e) === "FORBIDDEN", codeOf(e));
  }
  const runW = await escalateRun(agent, draft.id, VerificationTier.VERIFIED);
  check("agent opened VERIFIED run QUEUED", runW.status === VerificationStatus.QUEUED, runW.status);
  try {
    await escalateRun(agent, draft.id, VerificationTier.CERTIFIED);
    check("tier-skipping rejected", false);
  } catch (e) {
    check("tier-skipping rejected with CONFLICT", codeOf(e) === "CONFLICT", codeOf(e));
  }
  const doneW = await executeRun(tenant.id, runW.id, agent.userId);
  check("VERIFIED run PASSED (incl. no-regression check)", doneW.status === VerificationStatus.PASSED, doneW.status);

  console.log("Certified tier (human gate):");
  const runC = await escalateRun(agent, draft.id, VerificationTier.CERTIFIED);
  const parked = await executeRun(tenant.id, runC.id, agent.userId);
  check("CERTIFIED parks in RUNNING for human review", parked.status === VerificationStatus.RUNNING, parked.status);
  try {
    await decideCertifiedRun(depositor, runC.id, true, "smoke");
    check("depositor sign-off rejected", false);
  } catch (e) {
    check("depositor sign-off rejected with FORBIDDEN", codeOf(e) === "FORBIDDEN", codeOf(e));
  }
  const decided = await decideCertifiedRun(agent, runC.id, true, "smoke build test green");
  check("agent approval PASSES + issues certificate", decided.status === VerificationStatus.PASSED && decided.certificate !== null, {
    status: decided.status,
    cert: decided.certificate?.serialNo,
  });

  console.log("Tenant isolation:");
  try {
    await getRunDetail("000000000000000000000000", runV.id);
    check("foreign tenant run lookup rejected", false);
  } catch (e) {
    check("foreign tenant run lookup rejected with NOT_FOUND", codeOf(e) === "NOT_FOUND", codeOf(e));
  }

  // Cleanup: leave the DB exactly as seeded.
  const depositIds = [draft.id];
  await prisma.auditEvent.deleteMany({ where: { depositId: { in: depositIds } } });
  await prisma.certificate.deleteMany({ where: { verificationRun: { depositId: { in: depositIds } } } });
  await prisma.verificationRun.deleteMany({ where: { depositId: { in: depositIds } } });
  await prisma.asset.deleteMany({ where: { depositId: { in: depositIds } } });
  await prisma.deposit.deleteMany({ where: { id: { in: depositIds } } });

  await prisma.$disconnect();
  console.log(failures === 0 ? "SMOKE M4: all checks passed." : `SMOKE M4: ${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
