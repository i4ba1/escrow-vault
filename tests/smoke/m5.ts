// M5 smoke test (no Auth0 needed): the full release lifecycle — filing,
// notify + dispute window, maker-checker decision, delivery, plus the lapse
// path, GraphQL transport, RBAC and tenant isolation. Cleans up after itself.
// Run: pnpm smoke:m5 (DATABASE_URL comes from .env via --env-file).
import { ApolloServer } from "@apollo/server";
import { Role, ReleaseStatus } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { createAppContext, type AppContext } from "../../src/graphql/context";
import { resolvers } from "../../src/graphql/resolvers";
import { typeDefs } from "../../src/graphql/typeDefs";
import {
  decideRelease,
  disputeClaim,
  fileClaim,
  notifyVendor,
  recordDelivery,
} from "../../src/services/releases";
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

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" } });
  const users = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  const byRole = Object.fromEntries(users.map((u) => [u.role, u])) as Record<Role, (typeof users)[number]>;
  const beneficiary: Actor = { tenantId: tenant.id, userId: byRole.BENEFICIARY.id, role: Role.BENEFICIARY };
  const depositor: Actor = { tenantId: tenant.id, userId: byRole.DEPOSITOR.id, role: Role.DEPOSITOR };
  const agent1: Actor = { tenantId: tenant.id, userId: byRole.AGENT.id, role: Role.AGENT };
  // Second agent so the maker-checker rule has someone legal to decide.
  const agent2Row = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "agent2@demo.test",
      role: Role.AGENT,
      auth0Sub: "auth0|smoke-agent2",
    },
  });
  const agent2: Actor = { tenantId: tenant.id, userId: agent2Row.id, role: Role.AGENT };

  const agreement = await prisma.agreement.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const createdIds: string[] = [];

  console.log("Filing:");
  try {
    await fileClaim(depositor, agreement.id, "SUPPORT_FAILURE", "x", []);
    check("depositor filing rejected", false);
  } catch (e) {
    check("depositor filing rejected with FORBIDDEN", codeOf(e) === "FORBIDDEN", codeOf(e));
  }
  try {
    await fileClaim(beneficiary, agreement.id, "END_OF_LIFE", "not in contract", []);
    check("off-contract trigger rejected", false);
  } catch (e) {
    check("off-contract trigger rejected with CONFLICT", codeOf(e) === "CONFLICT", codeOf(e));
  }
  const claimA = await fileClaim(beneficiary, agreement.id, "SUPPORT_FAILURE", "45 days no response", ["SUP-1042"]);
  createdIds.push(claimA.id);
  check("claim FILED", claimA.status === ReleaseStatus.FILED, claimA.status);

  console.log("Disputed path + maker-checker:");
  try {
    await notifyVendor(beneficiary, claimA.id);
    check("beneficiary notify rejected", false);
  } catch (e) {
    check("beneficiary notify rejected with FORBIDDEN", codeOf(e) === "FORBIDDEN", codeOf(e));
  }
  const notified = await notifyVendor(agent1, claimA.id);
  check("NOTIFIED with ~30d window", notified.status === ReleaseStatus.NOTIFIED && (notified.disputeUntil?.getTime() ?? 0) > Date.now() + 29 * 86_400_000, notified.disputeUntil);
  check("notifier recorded", notified.notifiedById === agent1.userId, notified.notifiedById);
  const disputed = await disputeClaim(depositor, claimA.id, "Support resumed on all tickets");
  check("DISPUTED with counter-evidence", disputed.status === ReleaseStatus.DISPUTED, disputed.status);
  try {
    await decideRelease(agent1, claimA.id, true, "notifier decides own claim");
    check("notifier deciding rejected", false);
  } catch (e) {
    check("notifier deciding rejected with CONFLICT (maker-checker)", codeOf(e) === "CONFLICT", codeOf(e));
  }
  const approved = await decideRelease(agent2, claimA.id, true, "Outage confirmed by status page");
  check("second agent APPROVED", approved.status === ReleaseStatus.APPROVED && approved.decidedById === agent2.userId, approved.status);
  const delivered = await recordDelivery(agent2, claimA.id, "vault-transfer #4821");
  check("DELIVERED with handover ref", delivered.status === ReleaseStatus.DELIVERED && delivered.deliveryNote === "vault-transfer #4821", delivered.status);

  console.log("Lapse path:");
  const claimB = await fileClaim(beneficiary, agreement.id, "CESSATION", "vendor site dark", []);
  createdIds.push(claimB.id);
  await notifyVendor(agent2, claimB.id);
  await prisma.releaseRequest.update({
    where: { id: claimB.id },
    data: { disputeUntil: new Date(Date.now() - 1000) },
  });
  const lapsed = await decideRelease(agent1, claimB.id, true, "no dispute arrived");
  check("lapsed window auto-resolves to APPROVED", lapsed.status === ReleaseStatus.APPROVED, lapsed.status);
  const lapseAudit = await prisma.auditEvent.findFirst({
    where: { releaseRequestId: claimB.id, action: "UNDISPUTED" },
  });
  check("UNDISPUTED transition audited", lapseAudit !== null);

  console.log("GraphQL transport:");
  const server = new ApolloServer<AppContext>({ typeDefs, resolvers });
  await server.start();
  const res = await server.executeOperation(
    {
      query: `mutation($a: ID!) { fileClaim(agreementId: $a, trigger: CESSATION, evidenceSummary: "gql smoke") { id status trigger } }`,
      variables: { a: agreement.id },
    },
    { contextValue: createAppContext(beneficiary) },
  );
  if (res.body.kind !== "single") throw new Error("Unexpected batch response");
  const filed = (res.body.singleResult.data as { fileClaim: { id: string; status: string } } | undefined)?.fileClaim;
  check("fileClaim mutation via GraphQL", filed?.status === "FILED", res.body.singleResult);
  if (filed) createdIds.push(filed.id);
  await server.stop();

  console.log("Tenant isolation:");
  try {
    const { getReleaseDetail } = await import("../../src/services/releases");
    await getReleaseDetail("000000000000000000000000", claimA.id);
    check("foreign tenant lookup rejected", false);
  } catch (e) {
    check("foreign tenant lookup rejected with NOT_FOUND", codeOf(e) === "NOT_FOUND", codeOf(e));
  }

  // Cleanup: leave the DB exactly as seeded.
  await prisma.auditEvent.deleteMany({ where: { releaseRequestId: { in: createdIds } } });
  await prisma.releaseRequest.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.user.delete({ where: { id: agent2Row.id } });

  await prisma.$disconnect();
  console.log(failures === 0 ? "SMOKE M5: all checks passed." : `SMOKE M5: ${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
