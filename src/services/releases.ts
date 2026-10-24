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
  ReleaseStatus,
  ReleaseTrigger,
  type Prisma,
} from "@prisma/client";

export type ReleaseWithRelations = Prisma.ReleaseRequestGetPayload<{
  include: {
    agreement: { include: { conditions: true } };
    filedBy: true;
    notifiedBy: true;
    decidedBy: true;
  };
}>;

const TRIGGERS = Object.values(ReleaseTrigger) as string[];

export async function listReleaseRequests(
  tenantId: string,
  status?: ReleaseStatus,
): Promise<ReleaseWithRelations[]> {
  return prisma.releaseRequest.findMany({
    where: {
      agreement: { tenantId },
      ...(status ? { status } : {}),
    },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReleaseDetail(
  tenantId: string,
  requestId: string,
): Promise<ReleaseWithRelations> {
  const request = await prisma.releaseRequest.findFirst({
    where: { id: requestId, agreement: { tenantId } },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
  });
  if (!request) {
    throw new NotFoundError("Release request not found in this tenant.");
  }
  return request;
}

// FILED: beneficiary claims a trigger defined in the agreement's conditions,
// with evidence. Unknown triggers are rejected — releases only ever happen
// for contractually agreed events.
export async function fileClaim(
  actor: Actor,
  agreementId: string,
  trigger: string,
  evidenceSummary: string,
  evidenceTickets: string[],
): Promise<ReleaseWithRelations> {
  if (actor.role !== Role.BENEFICIARY) {
    throw new ForbiddenError("Only beneficiaries file release claims.");
  }
  if (!TRIGGERS.includes(trigger)) {
    throw new InputError(`Unknown trigger: ${trigger}.`);
  }
  const summary = evidenceSummary.trim();
  if (!summary) {
    throw new InputError("Evidence summary is required.");
  }
  const agreement = await prisma.agreement.findFirst({
    where: { id: agreementId, tenantId: actor.tenantId },
    include: { conditions: true },
  });
  if (!agreement) {
    throw new NotFoundError("Agreement not found in this tenant.");
  }
  if (agreement.status !== "ACTIVE") {
    throw new ConflictError(
      `Agreement is ${agreement.status}; claims require an ACTIVE agreement.`,
    );
  }
  const condition = agreement.conditions.find((c) => c.trigger === trigger);
  if (!condition) {
    throw new ConflictError(
      `Trigger ${trigger} is not a condition of this agreement.`,
    );
  }
  const request = await prisma.releaseRequest.create({
    data: {
      agreementId,
      filedById: actor.userId,
      trigger: trigger as ReleaseTrigger,
      evidence: {
        summary,
        tickets: evidenceTickets.map((t) => t.trim()).filter(Boolean),
      },
      status: ReleaseStatus.FILED,
    },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "ReleaseRequest",
    entityId: request.id,
    action: "FILED",
    diff: { trigger },
    releaseRequestId: request.id,
  });
  return request;
}

// FILED → NOTIFIED: the agent accepts the claim for processing, notifies the
// vendor, and opens the contractual dispute window. Records the notifier for
// the maker-checker rule at decision time.
export async function notifyVendor(
  actor: Actor,
  requestId: string,
): Promise<ReleaseWithRelations> {
  if (actor.role !== Role.AGENT) {
    throw new ForbiddenError("Only escrow agents process claims.");
  }
  const request = await getReleaseDetail(actor.tenantId, requestId);
  if (request.status !== ReleaseStatus.FILED) {
    throw new ConflictError(
      `Request is ${request.status}; only FILED claims can be notified.`,
    );
  }
  const condition = request.agreement.conditions.find(
    (c) => c.trigger === request.trigger,
  );
  const windowDays = condition?.disputeWindowDays ?? 14;
  const updated = await prisma.releaseRequest.update({
    where: { id: request.id },
    data: {
      status: ReleaseStatus.NOTIFIED,
      disputeUntil: new Date(Date.now() + windowDays * 24 * 3600 * 1000),
      notifiedById: actor.userId,
    },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "ReleaseRequest",
    entityId: request.id,
    action: "NOTIFIED",
    diff: { disputeWindowDays: windowDays },
    releaseRequestId: request.id,
  });
  return updated;
}

// NOTIFIED → DISPUTED: the vendor side contests the claim within the window,
// attaching counter-evidence. Filed by the vendor's depositor login.
export async function disputeClaim(
  actor: Actor,
  requestId: string,
  note: string,
): Promise<ReleaseWithRelations> {
  if (actor.role !== Role.DEPOSITOR && actor.role !== Role.AGENT) {
    throw new ForbiddenError("Only the vendor side can dispute a claim.");
  }
  const request = await getReleaseDetail(actor.tenantId, requestId);
  if (request.status !== ReleaseStatus.NOTIFIED) {
    throw new ConflictError(
      `Request is ${request.status}; only NOTIFIED claims can be disputed.`,
    );
  }
  if (request.disputeUntil && request.disputeUntil.getTime() < Date.now()) {
    throw new ConflictError("The dispute window has lapsed.");
  }
  const trimmed = note.trim();
  if (!trimmed) {
    throw new InputError("Counter-evidence note is required.");
  }
  const prior = (request.evidence as Record<string, unknown> | null) ?? {};
  const updated = await prisma.releaseRequest.update({
    where: { id: request.id },
    data: {
      status: ReleaseStatus.DISPUTED,
      evidence: {
        ...prior,
        dispute: { note: trimmed.slice(0, 1000), at: new Date().toISOString() },
      },
    },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "ReleaseRequest",
    entityId: request.id,
    action: "DISPUTED",
    releaseRequestId: request.id,
  });
  return updated;
}

// System sweep for lapsed dispute windows (scheduled job / worker). Returns
// the transitioned ids. Decisions also lapse lazily (see decideRelease).
export async function lapseDueWindows(tenantId?: string): Promise<string[]> {
  const due = await prisma.releaseRequest.findMany({
    where: {
      status: ReleaseStatus.NOTIFIED,
      disputeUntil: { lt: new Date() },
      ...(tenantId ? { agreement: { tenantId } } : {}),
    },
    select: { id: true, agreement: { select: { tenantId: true } } },
  });
  for (const request of due) {
    await prisma.releaseRequest.update({
      where: { id: request.id },
      data: { status: ReleaseStatus.UNDISPUTED },
    });
    await logEvent({
      tenantId: request.agreement.tenantId,
      entity: "ReleaseRequest",
      entityId: request.id,
      action: "UNDISPUTED",
      diff: { reason: "dispute window lapsed" },
      releaseRequestId: request.id,
    });
  }
  return due.map((d) => d.id);
}

// DISPUTED/UNDISPUTED → APPROVED/DENIED with the maker-checker rule: the
// deciding agent must differ from BOTH the filing beneficiary and the
// notifying agent. Violations are 409s, covered by smoke tests.
export async function decideRelease(
  actor: Actor,
  requestId: string,
  approve: boolean,
  rationale: string,
): Promise<ReleaseWithRelations> {
  if (actor.role !== Role.AGENT) {
    throw new ForbiddenError("Only escrow agents decide release claims.");
  }
  let request = await getReleaseDetail(actor.tenantId, requestId);
  if (
    request.status === ReleaseStatus.NOTIFIED &&
    request.disputeUntil &&
    request.disputeUntil.getTime() < Date.now()
  ) {
    await prisma.releaseRequest.update({
      where: { id: request.id },
      data: { status: ReleaseStatus.UNDISPUTED },
    });
    await logEvent({
      tenantId: actor.tenantId,
      entity: "ReleaseRequest",
      entityId: request.id,
      action: "UNDISPUTED",
      diff: { reason: "dispute window lapsed before decision" },
      releaseRequestId: request.id,
    });
    request = await getReleaseDetail(actor.tenantId, requestId);
  }
  if (
    request.status !== ReleaseStatus.DISPUTED &&
    request.status !== ReleaseStatus.UNDISPUTED
  ) {
    throw new ConflictError(
      `Request is ${request.status}; only DISPUTED or UNDISPUTED claims can be decided.`,
    );
  }
  if (request.filedById === actor.userId) {
    throw new ConflictError("Decider must differ from the filing party (maker-checker).");
  }
  if (request.notifiedById === actor.userId) {
    throw new ConflictError("Decider must differ from the notifying agent (maker-checker).");
  }
  const trimmed = rationale.trim();
  if (!trimmed) {
    throw new InputError("Decision rationale is required.");
  }
  const updated = await prisma.releaseRequest.update({
    where: { id: request.id },
    data: {
      status: approve ? ReleaseStatus.APPROVED : ReleaseStatus.DENIED,
      decidedById: actor.userId,
      decidedAt: new Date(),
    },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "ReleaseRequest",
    entityId: request.id,
    action: approve ? "APPROVED" : "DENIED",
    diff: { rationale: trimmed.slice(0, 500) },
    releaseRequestId: request.id,
  });
  return updated;
}

// APPROVED → DELIVERED: the agent records the secure handover of the
// deposited materials to the beneficiary. Terminal state.
export async function recordDelivery(
  actor: Actor,
  requestId: string,
  handoverRef: string,
): Promise<ReleaseWithRelations> {
  if (actor.role !== Role.AGENT) {
    throw new ForbiddenError("Only escrow agents record delivery.");
  }
  const request = await getReleaseDetail(actor.tenantId, requestId);
  if (request.status !== ReleaseStatus.APPROVED) {
    throw new ConflictError(
      `Request is ${request.status}; only APPROVED claims can be delivered.`,
    );
  }
  const ref = handoverRef.trim();
  if (!ref) {
    throw new InputError("Handover reference is required.");
  }
  const updated = await prisma.releaseRequest.update({
    where: { id: request.id },
    data: { status: ReleaseStatus.DELIVERED, deliveryNote: ref.slice(0, 500) },
    include: {
      agreement: { include: { conditions: true } },
      filedBy: true,
      notifiedBy: true,
      decidedBy: true,
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "ReleaseRequest",
    entityId: request.id,
    action: "DELIVERED",
    diff: { handoverRef: ref.slice(0, 500) },
    releaseRequestId: request.id,
  });
  return updated;
}
