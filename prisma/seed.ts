// Demo seed: one tenant, one agreement, four role users, one active deposit
// (v1) with scanned assets, one passed Validated run + certificate, and one
// notified release request. Idempotent: wipes the demo tenant and recreates it.
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
  // Delete in dependency order (ReleaseRequest.filedBy is Restrict).
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
        { email: "beneficiary@demo.test", role: Role.BENEFICIARY },
        { email: "auditor@demo.test", role: Role.AUDITOR },
      ] as const
    ).map((u) =>
      prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: u.email,
          role: u.role,
          // Placeholder subject; replaced by the real Auth0 `sub` in M2.
          auth0Sub: `auth0|seed-${u.role.toLowerCase()}`,
        },
      }),
    ),
  );
  const byRole = Object.fromEntries(users.map((u) => [u.role, u])) as Record<
    Role,
    (typeof users)[number]
  >;

  const agreement = await prisma.agreement.create({
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

  const deposit = await prisma.deposit.create({
    data: {
      agreementId: agreement.id,
      version: 1,
      status: DepositStatus.ACTIVE,
      activatedAt: new Date("2026-09-15T10:00:00Z"),
      assets: {
        create: [
          {
            type: AssetType.SOURCE,
            filename: "acme-core-2.4.1.tar.gz",
            s3Key: "demo/agreement-1/v1/source.tar.gz",
            sizeBytes: 48_231_680n,
            sha256: "seed-sha256-source-placeholder",
            scanStatus: ScanStatus.PASS,
          },
          {
            type: AssetType.DATABASE,
            filename: "schema-v47.sql",
            s3Key: "demo/agreement-1/v1/schema.sql",
            sizeBytes: 1_048_576n,
            sha256: "seed-sha256-schema-placeholder",
            scanStatus: ScanStatus.PASS,
          },
          {
            type: AssetType.BUILD_SCRIPT,
            filename: "build-and-deploy.sh",
            s3Key: "demo/agreement-1/v1/build.sh",
            sizeBytes: 12_288n,
            sha256: "seed-sha256-build-placeholder",
            scanStatus: ScanStatus.PASS,
          },
        ],
      },
    },
  });

  const run = await prisma.verificationRun.create({
    data: {
      depositId: deposit.id,
      tier: VerificationTier.VALIDATED,
      status: VerificationStatus.PASSED,
      findings: {
        checks: ["hash-match", "manifest-complete", "asset-type-coverage"],
        assetCount: 3,
        totalBytes: 49_292_544,
      },
      completedAt: new Date("2026-09-15T10:05:00Z"),
      certificate: {
        create: {
          tier: VerificationTier.VALIDATED,
          serialNo: "CERT-2026-0001",
        },
      },
    },
  });

  const release = await prisma.releaseRequest.create({
    data: {
      agreementId: agreement.id,
      filedById: byRole.BENEFICIARY.id,
      trigger: ReleaseTrigger.SUPPORT_FAILURE,
      evidence: {
        summary: "No response to three critical tickets in 45 days",
        tickets: ["SUP-1042", "SUP-1057", "SUP-1083"],
      },
      status: ReleaseStatus.NOTIFIED,
      disputeUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        actorId: byRole.DEPOSITOR.id,
        entity: "Deposit",
        entityId: deposit.id,
        action: "ACTIVATED",
        depositId: deposit.id,
      },
      {
        tenantId: tenant.id,
        actorId: byRole.AGENT.id,
        entity: "VerificationRun",
        entityId: run.id,
        action: "PASSED",
        verificationRunId: run.id,
      },
      {
        tenantId: tenant.id,
        actorId: byRole.BENEFICIARY.id,
        entity: "ReleaseRequest",
        entityId: release.id,
        action: "NOTIFIED",
        releaseRequestId: release.id,
      },
    ],
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
