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
