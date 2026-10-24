// Demo seed: one tenant, five role users, two agreements, five deposits,
// six certificates across all three tiers, three release requests in
// different states, and a ~20-event audit timeline. Deterministic: wipes the
// demo tenant and recreates it, so certificate serials are stable
// (CERT-2026-0001 is created first — the e2e suite depends on it).
// Run with: pnpm db:seed (DATABASE_URL comes from .env via --env-file).
import {
  PrismaClient,
  Role,
  AgreementStatus,
  ReleaseTrigger,
  DepositStatus,
  AssetType,
  ScanStatus,
  VerificationTier,
  VerificationStatus,
  ReleaseStatus,
  type Prisma,
} from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_SLUG = "demo";

async function wipeDemoTenant() {
  const existing = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!existing) return;
  const tenantId = existing.id;
  // Delete in dependency order (ReleaseRequest user FKs are Restrict).
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.certificate.deleteMany({
    where: { verificationRun: { deposit: { agreement: { tenantId } } } },
  });
  await prisma.verificationRun.deleteMany({
    where: { deposit: { agreement: { tenantId } } },
  });
  await prisma.asset.deleteMany({
    where: { deposit: { agreement: { tenantId } } },
  });
  await prisma.deposit.deleteMany({ where: { agreement: { tenantId } } });
  await prisma.releaseRequest.deleteMany({
    where: { agreement: { tenantId } },
  });
  await prisma.releaseCondition.deleteMany({
    where: { agreement: { tenantId } },
  });
  await prisma.agreement.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

type UserRow = { id: string; role: Role };

const auditTrail: {
  actorId?: string;
  entity: string;
  entityId: string;
  action: string;
  depositId?: string;
  verificationRunId?: string;
  releaseRequestId?: string;
}[] = [];

function log(
  actor: UserRow | null,
  entity: string,
  entityId: string,
  action: string,
  links: { depositId?: string; verificationRunId?: string; releaseRequestId?: string } = {},
) {
  auditTrail.push({
    actorId: actor?.id,
    entity,
    entityId,
    action,
    ...links,
  });
}

async function main() {
  await wipeDemoTenant();

  const tenant = await prisma.tenant.create({
    data: { slug: TENANT_SLUG, name: "Demo Escrow Tenant" },
  });

  const users = await Promise.all(
    (
      [
        { email: "depositor@demo.test", role: Role.DEPOSITOR },
        { email: "agent@demo.test", role: Role.AGENT },
        { email: "agent2@demo.test", role: Role.AGENT },
        { email: "beneficiary@demo.test", role: Role.BENEFICIARY },
        { email: "auditor@demo.test", role: Role.AUDITOR },
      ] as const
    ).map((u) =>
      prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: u.email,
          role: u.role,
          // Placeholder subjects; replaced by real Auth0 `sub`s (see README).
          auth0Sub: `auth0|seed-${u.email.split("@")[0]}`,
        },
      }),
    ),
  );
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u])) as Record<
    string,
    (typeof users)[number]
  >;
  const depositor = byEmail["depositor@demo.test"];
  const agent = byEmail["agent@demo.test"];
  const agent2 = byEmail["agent2@demo.test"];
  const beneficiary = byEmail["beneficiary@demo.test"];

  const agreementA = await prisma.agreement.create({
    data: {
      tenantId: tenant.id,
      vendorName: "Acme Software BV",
      beneficiaryName: "Globex Bank NV",
      status: AgreementStatus.ACTIVE,
      activatedAt: new Date("2026-09-01T09:00:00Z"),
      conditions: {
        create: [
          {
            trigger: ReleaseTrigger.CESSATION,
            description: "Vendor ceases business operations",
            disputeWindowDays: 14,
          },
          {
            trigger: ReleaseTrigger.SUPPORT_FAILURE,
            description: "No critical support response within 30 days",
            disputeWindowDays: 30,
          },
        ],
      },
    },
  });

  const agreementB = await prisma.agreement.create({
    data: {
      tenantId: tenant.id,
      vendorName: "Initech LLC",
      beneficiaryName: "Umbrella Health Inc",
      status: AgreementStatus.ACTIVE,
      activatedAt: new Date("2026-09-20T09:00:00Z"),
      conditions: {
        create: [
          {
            trigger: ReleaseTrigger.BREACH,
            description: "Material breach of the license agreement",
            disputeWindowDays: 14,
          },
          {
            trigger: ReleaseTrigger.END_OF_LIFE,
            description: "Product end-of-life announcement",
            disputeWindowDays: 30,
          },
        ],
      },
    },
  });

  async function makeDeposit(
    agreementId: string,
    version: number,
    status: DepositStatus,
    activatedAt: string | null,
    assets: { type: AssetType; filename: string; s3Key: string; sizeBytes: bigint }[],
  ) {
    const deposit = await prisma.deposit.create({
      data: {
        agreementId,
        version,
        status,
        activatedAt: activatedAt ? new Date(activatedAt) : null,
        assets: {
          create: assets.map((a) => ({
            ...a,
            sha256: `seed-sha256-${a.filename}`,
            scanStatus: status === DepositStatus.DRAFT ? ScanStatus.PENDING : ScanStatus.PASS,
          })),
        },
      },
      include: { assets: true },
    });
    if (status !== DepositStatus.DRAFT) {
      log(depositor, "Deposit", deposit.id, "ACTIVATED", { depositId: deposit.id });
    }
    return deposit;
  }

  let serial = 0;
  async function makeRun(
    depositId: string,
    tier: VerificationTier,
    status: VerificationStatus,
    completedAt: string,
    checkNames: string[],
    decidedBy: UserRow | null = null,
  ) {
    serial += 1;
    const run = await prisma.verificationRun.create({
      data: {
        depositId,
        tier,
        status,
        findings: {
          passed: status === VerificationStatus.PASSED,
          checks: checkNames.map((name) => ({
            name,
            pass: status === VerificationStatus.PASSED,
            detail: status === VerificationStatus.PASSED ? "satisfied" : "not satisfied",
          })),
        },
        completedAt: new Date(completedAt),
        certificate:
          status === VerificationStatus.PASSED
            ? {
                create: {
                  tier,
                  serialNo: `CERT-2026-${String(serial).padStart(4, "0")}`,
                },
              }
            : undefined,
      },
    });
    log(agent, "VerificationRun", run.id, status, {
      depositId,
      verificationRunId: run.id,
    });
    if (status === VerificationStatus.PASSED) {
      const cert = await prisma.certificate.findUniqueOrThrow({
        where: { verificationRunId: run.id },
      });
      log(decidedBy ?? agent, "Certificate", cert.id, "ISSUED", {
        depositId,
        verificationRunId: run.id,
      });
    }
    return run;
  }

  // Agreement A, v1: the long-standing protected release (CERT-2026-0001).
  const a1 = await makeDeposit(agreementA.id, 1, DepositStatus.ACTIVE, "2026-09-15T10:00:00Z", [
    { type: AssetType.SOURCE, filename: "acme-core-2.4.1.tar.gz", s3Key: "demo/agreement-a/v1/source.tar.gz", sizeBytes: 48_231_680n },
    { type: AssetType.DATABASE, filename: "schema-v47.sql", s3Key: "demo/agreement-a/v1/schema.sql", sizeBytes: 1_048_576n },
    { type: AssetType.BUILD_SCRIPT, filename: "build-and-deploy.sh", s3Key: "demo/agreement-a/v1/build.sh", sizeBytes: 12_288n },
  ]);
  await makeRun(a1.id, VerificationTier.VALIDATED, VerificationStatus.PASSED, "2026-09-15T10:05:00Z", [
    "scan-clean",
    "source-present",
    "supporting-coverage",
  ]);

  // Agreement A, v2: current release, verified two tiers deep.
  const a2 = await makeDeposit(agreementA.id, 2, DepositStatus.ACTIVE, "2026-10-02T09:00:00Z", [
    { type: AssetType.SOURCE, filename: "acme-core-2.5.0.tar.gz", s3Key: "demo/agreement-a/v2/source.tar.gz", sizeBytes: 51_380_224n },
    { type: AssetType.DATABASE, filename: "schema-v52.sql", s3Key: "demo/agreement-a/v2/schema.sql", sizeBytes: 1_155_072n },
    { type: AssetType.BUILD_SCRIPT, filename: "build-and-deploy.sh", s3Key: "demo/agreement-a/v2/build.sh", sizeBytes: 13_312n },
    { type: AssetType.DOCS, filename: "runbook.md", s3Key: "demo/agreement-a/v2/runbook.md", sizeBytes: 96_256n },
  ]);
  await makeRun(a2.id, VerificationTier.VALIDATED, VerificationStatus.PASSED, "2026-10-02T09:06:00Z", [
    "scan-clean",
    "source-present",
    "supporting-coverage",
  ]);
  await makeRun(a2.id, VerificationTier.VERIFIED, VerificationStatus.PASSED, "2026-10-03T14:00:00Z", [
    "scan-clean",
    "source-present",
    "supporting-coverage",
    "content-profile",
    "no-asset-regression",
  ]);

  // Agreement A, v3: draft being assembled (shows the in-progress state).
  await makeDeposit(agreementA.id, 3, DepositStatus.DRAFT, null, []);

  // Agreement B, v1: fully certified flagship deposit.
  const b1 = await makeDeposit(agreementB.id, 1, DepositStatus.ACTIVE, "2026-10-10T11:00:00Z", [
    { type: AssetType.SOURCE, filename: "initech-tps-9.1.0.tar.gz", s3Key: "demo/agreement-b/v1/source.tar.gz", sizeBytes: 88_080_384n },
    { type: AssetType.DATABASE, filename: "tps-schema.sql", s3Key: "demo/agreement-b/v1/schema.sql", sizeBytes: 2_097_152n },
    { type: AssetType.CONFIG, filename: "prod.env.yaml", s3Key: "demo/agreement-b/v1/prod.yaml", sizeBytes: 24_576n },
    { type: AssetType.BUILD_SCRIPT, filename: "Makefile", s3Key: "demo/agreement-b/v1/Makefile", sizeBytes: 8_192n },
    { type: AssetType.API_SPEC, filename: "openapi.yaml", s3Key: "demo/agreement-b/v1/openapi.yaml", sizeBytes: 512_000n },
  ]);
  await makeRun(b1.id, VerificationTier.VALIDATED, VerificationStatus.PASSED, "2026-10-10T11:07:00Z", [
    "scan-clean",
    "source-present",
    "supporting-coverage",
  ]);
  await makeRun(b1.id, VerificationTier.VERIFIED, VerificationStatus.PASSED, "2026-10-11T10:00:00Z", [
    "scan-clean",
    "source-present",
    "supporting-coverage",
    "content-profile",
    "no-asset-regression",
  ]);
  await makeRun(
    b1.id,
    VerificationTier.CERTIFIED,
    VerificationStatus.PASSED,
    "2026-10-12T16:30:00Z",
    ["scan-clean", "source-present", "supporting-coverage", "content-profile", "no-asset-regression", "build-reproducible", "human-build-test"],
    agent2,
  );

  async function makeRelease(
    agreementId: string,
    trigger: ReleaseTrigger,
    evidence: Prisma.InputJsonValue,
    status: ReleaseStatus,
    filedBy: UserRow,
    notifiedBy: UserRow | null,
    decidedBy: UserRow | null,
    disputeUntil: Date | null,
    deliveryNote: string | null,
  ) {
    const request = await prisma.releaseRequest.create({
      data: {
        agreementId,
        filedById: filedBy.id,
        trigger,
        evidence,
        status,
        disputeUntil,
        notifiedById: notifiedBy?.id,
        decidedById: decidedBy?.id,
        decidedAt: decidedBy ? new Date("2026-10-14T09:00:00Z") : null,
        deliveryNote,
      },
    });
    log(filedBy, "ReleaseRequest", request.id, "FILED", { releaseRequestId: request.id });
    if (notifiedBy) {
      log(notifiedBy, "ReleaseRequest", request.id, "NOTIFIED", { releaseRequestId: request.id });
    }
    if (status === ReleaseStatus.DISPUTED || status === ReleaseStatus.DENIED) {
      log(depositor, "ReleaseRequest", request.id, "DISPUTED", { releaseRequestId: request.id });
    }
    if (decidedBy) {
      log(decidedBy, "ReleaseRequest", request.id, status, { releaseRequestId: request.id });
    }
    return request;
  }

  // Live claim awaiting vendor response (30-day SUPPORT_FAILURE window).
  await makeRelease(
    agreementA.id,
    ReleaseTrigger.SUPPORT_FAILURE,
    { summary: "No response to three critical tickets in 45 days", tickets: ["SUP-1042", "SUP-1057", "SUP-1083"] },
    ReleaseStatus.NOTIFIED,
    beneficiary,
    agent,
    null,
    new Date(Date.now() + 30 * 24 * 3600 * 1000),
    null,
  );

  // Completed delivery: filed → notified → undisputed → approved → delivered.
  // Maker-checker respected: notified by agent, decided by agent2.
  await makeRelease(
    agreementA.id,
    ReleaseTrigger.CESSATION,
    { summary: "Vendor holding company filed for administration", tickets: [] },
    ReleaseStatus.DELIVERED,
    beneficiary,
    agent,
    agent2,
    new Date("2026-09-30T12:00:00Z"),
    "vault-transfer #4177, confirmed by beneficiary counsel",
  );

  // Denied claim with a vendor dispute on record.
  await makeRelease(
    agreementB.id,
    ReleaseTrigger.BREACH,
    {
      summary: "Alleged API rate-limit breach on enterprise tier",
      tickets: ["SUP-2011"],
      dispute: { note: "Limits were raised by amendment 3; no breach occurred", at: "2026-10-13T10:00:00Z" },
    },
    ReleaseStatus.DENIED,
    beneficiary,
    agent,
    agent2,
    new Date("2026-10-20T12:00:00Z"),
    null,
  );

  await prisma.auditEvent.createMany({
    data: auditTrail.map((e) => ({ tenantId: tenant.id, ...e })),
  });

  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count({ where: { tenantId: tenant.id } }),
    agreements: await prisma.agreement.count({ where: { tenantId: tenant.id } }),
    deposits: await prisma.deposit.count(),
    assets: await prisma.asset.count(),
    runs: await prisma.verificationRun.count(),
    certificates: await prisma.certificate.count(),
    releases: await prisma.releaseRequest.count(),
    auditEvents: await prisma.auditEvent.count(),
  };
  console.log(`Seeded tenant '${TENANT_SLUG}':`, counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
