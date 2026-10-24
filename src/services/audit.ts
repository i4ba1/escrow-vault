import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditLogInput {
  tenantId: string;
  actorId?: string;
  entity: string;
  entityId: string;
  action: string;
  diff?: Prisma.InputJsonValue;
  depositId?: string;
  verificationRunId?: string;
  releaseRequestId?: string;
}

// Single append point for the immutable audit timeline. There is deliberately
// no update/delete API for AuditEvent anywhere in the codebase.
export async function logEvent(input: AuditLogInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      diff: input.diff,
      depositId: input.depositId,
      verificationRunId: input.verificationRunId,
      releaseRequestId: input.releaseRequestId,
    },
  });
}

export interface AuditTimelineEntry {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorEmail: string | null;
  at: Date;
}

// Newest-first timeline, tenant-scoped. The portal audit page and the
// dashboard activity feed both read through here.
export async function listAuditEvents(
  tenantId: string,
  limit = 100,
): Promise<AuditTimelineEntry[]> {
  const take = Math.min(Math.max(limit, 1), 200);
  const events = await prisma.auditEvent.findMany({
    where: { tenantId },
    include: { actor: { select: { email: true } } },
    orderBy: { at: "desc" },
    take,
  });
  return events.map((e) => ({
    id: e.id,
    entity: e.entity,
    entityId: e.entityId,
    action: e.action,
    actorEmail: e.actor?.email ?? null,
    at: e.at,
  }));
}
