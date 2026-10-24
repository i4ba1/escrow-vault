// M3 smoke test (no Auth0 needed): exercises the GraphQL layer with forged
// per-request contexts plus the full upload→scan loop against S3Mock.
// Run: pnpm smoke:m3 (DATABASE_URL + S3_* come from .env via --env-file).
import { createHash, randomBytes } from "node:crypto";
import { ApolloServer } from "@apollo/server";
import { Role } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { createAppContext, type AppContext } from "../../src/graphql/context";
import { resolvers } from "../../src/graphql/resolvers";
import { typeDefs } from "../../src/graphql/typeDefs";
import { requestUploadUrl } from "../../src/services/uploads";
import { scanPendingAssets } from "../../src/services/scan";
import { createDraftDeposit } from "../../src/services/deposits";

let failures = 0;

function check(name: string, condition: unknown, extra?: unknown): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}`, extra ?? "");
  }
}

async function gql(
  server: ApolloServer<AppContext>,
  query: string,
  variables: Record<string, unknown> | undefined,
  actor: { tenantId: string; userId: string; role: Role },
): Promise<{ data?: unknown; errors?: readonly { message: string; extensions?: unknown }[] }> {
  const res = await server.executeOperation(
    { query, variables },
    { contextValue: createAppContext(actor) },
  );
  if (res.body.kind !== "single") throw new Error("Unexpected batch response");
  return res.body.singleResult as {
    data?: unknown;
    errors?: readonly { message: string; extensions?: unknown }[];
  };
}

async function main(): Promise<void> {
  const server = new ApolloServer<AppContext>({ typeDefs, resolvers });
  await server.start();

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" } });
  const users = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  const byRole = Object.fromEntries(users.map((u) => [u.role, u])) as Record<Role, (typeof users)[number]>;
  const depositor = { tenantId: tenant.id, userId: byRole.DEPOSITOR.id, role: Role.DEPOSITOR };
  const auditor = { tenantId: tenant.id, userId: byRole.AUDITOR.id, role: Role.AUDITOR };

  console.log("GraphQL reads (tenant-scoped):");
  const deposits = await gql(
    server,
    `query { deposits { id version status assets { filename scanStatus } verificationRuns { tier status certificate { serialNo } } } }`,
    undefined,
    depositor,
  );
  const list = (deposits.data as { deposits: unknown[] } | undefined)?.deposits;
  check("sees seeded deposit with assets + run (DataLoader path)", Array.isArray(list) && list.length === 1, deposits);

  console.log("RBAC on mutations:");
  const forbidden = await gql(
    server,
    `mutation($id: ID!) { activateDeposit(depositId: $id) { id } }`,
    { id: "whatever" },
    auditor,
  );
  check(
    "auditor activateDeposit rejected with FORBIDDEN",
    (forbidden.errors ?? []).some((e) =>
      JSON.stringify(e.extensions ?? {}).includes("FORBIDDEN"),
    ),
    forbidden,
  );

  console.log("Tenant isolation:");
  const foreign = await gql(
    server,
    `query { deposits { id } }`,
    undefined,
    { ...depositor, tenantId: "000000000000000000000000" },
  );
  check(
    "foreign tenantId sees zero deposits",
    ((foreign.data as { deposits: unknown[] } | undefined)?.deposits ?? []).length === 0,
    foreign,
  );

  console.log("Upload → scan loop:");
  const agreement = await prisma.agreement.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const draft = await createDraftDeposit(depositor, agreement.id);
  check("draft created at next version", draft.version === 2, draft.version);

  const payload = randomBytes(64 * 1024);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const signed = await requestUploadUrl({
    ...depositor,
    depositId: draft.id,
    filename: "smoke-report.bin",
    assetType: "SOURCE",
    sizeBytes: payload.byteLength,
    sha256,
  });
  check("presigned URL minted against local endpoint", signed.url.startsWith("http://localhost:9090/"), signed.url);

  const put = await fetch(signed.url, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: new Blob([payload.buffer as ArrayBuffer]),
  });
  check("PUT to presigned URL accepted", put.status === 200, put.status);

  const summary = await scanPendingAssets();
  check("scan pass processed the asset", summary.checked >= 1 && summary.passed >= 1, summary);
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: signed.assetId } });
  check("asset flipped to PASS", asset.scanStatus === "PASS", asset.scanStatus);
  const run = await prisma.verificationRun.findFirst({ where: { depositId: draft.id } });
  check("Validated run queued", run?.tier === "VALIDATED" && run?.status === "QUEUED", run);

  // Leave the DB as seeded: remove the smoke draft (cascades to its assets/run).
  await prisma.auditEvent.deleteMany({ where: { depositId: draft.id } });
  await prisma.verificationRun.deleteMany({ where: { depositId: draft.id } });
  await prisma.asset.deleteMany({ where: { depositId: draft.id } });
  await prisma.deposit.delete({ where: { id: draft.id } });

  await server.stop();
  await prisma.$disconnect();
  console.log(failures === 0 ? "SMOKE M3: all checks passed." : `SMOKE M3: ${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
