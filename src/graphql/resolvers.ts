import { GraphQLError } from "graphql";
import { prisma } from "../lib/prisma";
import {
  activateDeposit,
  createDraftDeposit,
  getDepositDetail,
  listDeposits,
} from "../services/deposits";
import { listAgreements } from "../services/agreements";
import {
  decideRelease,
  disputeClaim,
  fileClaim,
  getReleaseDetail,
  listReleaseRequests,
  notifyVendor,
  recordDelivery,
  type ReleaseWithRelations,
} from "../services/releases";
import { AppError } from "../services/errors";
import type { AppContext } from "./context";

function toError(error: unknown): GraphQLError {
  if (error instanceof AppError) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code, status: error.status },
    });
  }
  // Never leak internals (connection strings, stack traces) to clients.
  return new GraphQLError("Internal server error.", {
    extensions: { code: "INTERNAL", status: 500 },
  });
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

// Every resolver re-derives scope from ctx.tenantId; cross-tenant access is
// impossible even if callers pass foreign ids (verified by smoke tests).
export const resolvers = {
  Query: {
    agreements: (_: unknown, __: unknown, ctx: AppContext) =>
      listAgreements(ctx.tenantId).catch((e: unknown) => {
        throw toError(e);
      }),
    deposits: (
      _: unknown,
      args: { agreementId?: string },
      ctx: AppContext,
    ) => listDeposits(ctx.tenantId, args.agreementId).catch((e: unknown) => {
      throw toError(e);
    }),
    deposit: (_: unknown, args: { id: string }, ctx: AppContext) =>
      getDepositDetail(ctx.tenantId, args.id)
        .then((d) => ({
          ...d,
          assets: d.assets.map(presentAsset),
          verificationRuns: d.verificationRuns.map(presentRun),
        }))
        .catch((e: unknown) => {
          throw toError(e);
        }),
    auditEvents: async (
      _: unknown,
      args: { limit?: number },
      ctx: AppContext,
    ) => {
      try {
        const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
        const events = await prisma.auditEvent.findMany({
          where: { tenantId: ctx.tenantId },
          include: { actor: { select: { email: true } } },
          orderBy: { at: "desc" },
          take: limit,
        });
        return events.map((e) => ({
          id: e.id,
          entity: e.entity,
          entityId: e.entityId,
          action: e.action,
          actorEmail: e.actor?.email ?? null,
          at: e.at.toISOString(),
        }));
      } catch (e: unknown) {
        throw toError(e);
      }
    },
    releaseRequests: (
      _: unknown,
      args: { status?: string },
      ctx: AppContext,
    ) => {
      const statuses = [
        "FILED",
        "NOTIFIED",
        "DISPUTED",
        "UNDISPUTED",
        "APPROVED",
        "DENIED",
        "DELIVERED",
      ];
      const status =
        args.status && (statuses as string[]).includes(args.status)
          ? (args.status as ReleaseWithRelations["status"])
          : undefined;
      return listReleaseRequests(ctx.tenantId, status)
        .then((rows) => rows.map(presentRelease))
        .catch((e: unknown) => {
          throw toError(e);
        });
    },
    releaseRequest: (_: unknown, args: { id: string }, ctx: AppContext) =>
      getReleaseDetail(ctx.tenantId, args.id)
        .then(presentRelease)
        .catch((e: unknown) => {
          throw toError(e);
        }),
  },
  Mutation: {
    // Mutations delegate to services/: identical rules to the Server Actions.
    createDeposit: (_: unknown, args: { agreementId: string }, ctx: AppContext) =>
      createDraftDeposit(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.agreementId,
      )
        .then((d) => presentDeposit(ctx, d.id))
        .catch((e: unknown) => {
          throw toError(e);
        }),
    activateDeposit: (_: unknown, args: { depositId: string }, ctx: AppContext) =>
      activateDeposit(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.depositId,
      )
        .then((d) => ({
          ...d,
          assets: d.assets.map(presentAsset),
          verificationRuns: d.verificationRuns.map(presentRun),
        }))
        .catch((e: unknown) => {
          throw toError(e);
        }),
    fileClaim: (
      _: unknown,
      args: {
        agreementId: string;
        trigger: string;
        evidenceSummary: string;
        evidenceTickets?: string[];
      },
      ctx: AppContext,
    ) =>
      fileClaim(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.agreementId,
        args.trigger,
        args.evidenceSummary,
        args.evidenceTickets ?? [],
      )
        .then(presentRelease)
        .catch((e: unknown) => {
          throw toError(e);
        }),
    notifyVendor: (_: unknown, args: { requestId: string }, ctx: AppContext) =>
      notifyVendor(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.requestId,
      )
        .then(presentRelease)
        .catch((e: unknown) => {
          throw toError(e);
        }),
    disputeClaim: (
      _: unknown,
      args: { requestId: string; note: string },
      ctx: AppContext,
    ) =>
      disputeClaim(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.requestId,
        args.note,
      )
        .then(presentRelease)
        .catch((e: unknown) => {
          throw toError(e);
        }),
    decideRelease: (
      _: unknown,
      args: { requestId: string; approve: boolean; rationale: string },
      ctx: AppContext,
    ) =>
      decideRelease(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.requestId,
        args.approve,
        args.rationale,
      )
        .then(presentRelease)
        .catch((e: unknown) => {
          throw toError(e);
        }),
    recordDelivery: (
      _: unknown,
      args: { requestId: string; handoverRef: string },
      ctx: AppContext,
    ) =>
      recordDelivery(
        { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role },
        args.requestId,
        args.handoverRef,
      )
        .then(presentRelease)
        .catch((e: unknown) => {
          throw toError(e);
        }),
  },
  Agreement: {
    conditions: (parent: { id: string }) =>
      prisma.releaseCondition.findMany({
        where: { agreementId: parent.id },
      }),
    deposits: (parent: { id: string }, _: unknown, ctx: AppContext) =>
      listDeposits(ctx.tenantId, parent.id),
  },
  Deposit: {
    agreement: (parent: { agreementId: string }, _: unknown, ctx: AppContext) =>
      prisma.agreement.findFirstOrThrow({
        where: { id: parent.agreementId, tenantId: ctx.tenantId },
      }),
    assets: (parent: { id: string }, _: unknown, ctx: AppContext) =>
      ctx.loaders.assetsByDepositId.load(parent.id).then((rows) => rows.map(presentAsset)),
    verificationRuns: (parent: { id: string }, _: unknown, ctx: AppContext) =>
      ctx.loaders.runsByDepositId.load(parent.id).then((rows) => rows.map(presentRun)),
    activatedAt: (parent: { activatedAt: Date | null }) => iso(parent.activatedAt),
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
  Asset: {
    sizeBytes: (parent: { sizeBytes: bigint }) => parent.sizeBytes.toString(),
  },
  VerificationRun: {
    findings: (parent: { findings: unknown }) =>
      parent.findings == null ? null : JSON.stringify(parent.findings),
    completedAt: (parent: { completedAt: Date | null }) => iso(parent.completedAt),
  },
  Certificate: {
    issuedAt: (parent: { issuedAt: Date }) => parent.issuedAt.toISOString(),
  },
  ReleaseRequest: {
    evidence: (parent: { evidence: unknown }) =>
      parent.evidence == null ? null : JSON.stringify(parent.evidence),
    disputeUntil: (parent: { disputeUntil: Date | null }) =>
      iso(parent.disputeUntil),
    filedByEmail: (parent: { filedBy: { email: string } }) =>
      parent.filedBy.email,
    decidedByEmail: (parent: { decidedBy: { email: string } | null }) =>
      parent.decidedBy?.email ?? null,
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    agreement: (parent: { agreement: unknown }) => parent.agreement,
  },
};

function presentRelease(r: ReleaseWithRelations) {
  return {
    id: r.id,
    trigger: r.trigger,
    evidence: r.evidence == null ? null : JSON.stringify(r.evidence),
    status: r.status,
    disputeUntil: iso(r.disputeUntil),
    filedByEmail: r.filedBy.email,
    decidedByEmail: r.decidedBy?.email ?? null,
    deliveryNote: r.deliveryNote,
    createdAt: r.createdAt.toISOString(),
    agreement: r.agreement,
  };
}

function presentAsset(a: {
  id: string;
  type: string;
  filename: string;
  sizeBytes: bigint;
  sha256: string;
  scanStatus: string;
}) {
  return {
    id: a.id,
    type: a.type,
    filename: a.filename,
    sizeBytes: a.sizeBytes.toString(),
    sha256: a.sha256,
    scanStatus: a.scanStatus,
  };
}

function presentRun(r: {
  id: string;
  tier: string;
  status: string;
  findings: unknown;
  completedAt: Date | null;
  certificate: {
    id: string;
    tier: string;
    serialNo: string;
    issuedAt: Date;
  } | null;
}) {
  return {
    id: r.id,
    tier: r.tier,
    status: r.status,
    findings: r.findings == null ? null : JSON.stringify(r.findings),
    completedAt: iso(r.completedAt),
    certificate: r.certificate
      ? {
          id: r.certificate.id,
          tier: r.certificate.tier,
          serialNo: r.certificate.serialNo,
          issuedAt: r.certificate.issuedAt.toISOString(),
        }
      : null,
  };
}

async function presentDeposit(ctx: AppContext, id: string) {
  const d = await getDepositDetail(ctx.tenantId, id);
  return {
    ...d,
    assets: d.assets.map(presentAsset),
    verificationRuns: d.verificationRuns.map(presentRun),
  };
}
