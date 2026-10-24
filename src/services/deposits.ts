import { prisma } from "../lib/prisma";
import { logEvent } from "./audit";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";
import { DepositStatus, Role, type Actor } from "./types";
import type { Deposit, Prisma } from "@prisma/client";

export type DepositWithRelations = Prisma.DepositGetPayload<{
  include: {
    agreement: true;
    assets: true;
    verificationRuns: { include: { certificate: true } };
  };
}>;

function scopedAgreement(tenantId: string, agreementId: string) {
  return prisma.agreement.findFirst({
    where: { id: agreementId, tenantId },
  });
}

export async function listDeposits(
  tenantId: string,
  agreementId?: string,
): Promise<Deposit[]> {
  return prisma.deposit.findMany({
    where: {
      agreement: { tenantId },
      ...(agreementId ? { agreementId } : {}),
    },
    orderBy: [{ agreementId: "asc" }, { version: "desc" }],
  });
}

export async function getDepositDetail(
  tenantId: string,
  depositId: string,
): Promise<DepositWithRelations> {
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, agreement: { tenantId } },
    include: {
      agreement: true,
      assets: { orderBy: { createdAt: "asc" } },
      verificationRuns: {
        include: { certificate: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!deposit) {
    throw new NotFoundError("Deposit not found in this tenant.");
  }
  return deposit;
}

// DRAFT → (uploads) → ACTIVE. A new draft always takes max(version)+1 within
// its agreement so versions are monotonic per agreement.
export async function createDraftDeposit(
  actor: Actor,
  agreementId: string,
): Promise<Deposit> {
  if (actor.role !== Role.DEPOSITOR) {
    throw new ForbiddenError("Only depositors can create deposits.");
  }
  const agreement = await scopedAgreement(actor.tenantId, agreementId);
  if (!agreement) {
    throw new NotFoundError("Agreement not found in this tenant.");
  }
  if (agreement.status !== "ACTIVE") {
    throw new ConflictError(
      `Agreement is ${agreement.status}; deposits require an ACTIVE agreement.`,
    );
  }
  const latest = await prisma.deposit.findFirst({
    where: { agreementId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const deposit = await prisma.deposit.create({
    data: {
      agreementId,
      version: (latest?.version ?? 0) + 1,
      status: DepositStatus.DRAFT,
    },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "Deposit",
    entityId: deposit.id,
    action: "CREATED",
    diff: { version: deposit.version },
    depositId: deposit.id,
  });
  return deposit;
}

// Activation requires at least one asset and every asset scanned PASS.
// Anything else is a 409, never a silent partial activation.
export async function activateDeposit(
  actor: Actor,
  depositId: string,
): Promise<DepositWithRelations> {
  if (actor.role !== Role.DEPOSITOR) {
    throw new ForbiddenError("Only depositors can activate deposits.");
  }
  const deposit = await getDepositDetail(actor.tenantId, depositId);
  if (deposit.status !== DepositStatus.DRAFT && deposit.status !== DepositStatus.UPLOADING) {
    throw new ConflictError(`Deposit is ${deposit.status}; only drafts can be activated.`);
  }
  if (deposit.assets.length === 0) {
    throw new ConflictError("Deposit has no assets; upload at least one file.");
  }
  const unscanned = deposit.assets.filter((a) => a.scanStatus !== "PASS");
  if (unscanned.length > 0) {
    throw new ConflictError(
      `${unscanned.length} asset(s) have not passed the integrity scan.`,
    );
  }
  await prisma.deposit.update({
    where: { id: deposit.id },
    data: { status: DepositStatus.ACTIVE, activatedAt: new Date() },
  });
  await logEvent({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entity: "Deposit",
    entityId: deposit.id,
    action: "ACTIVATED",
    diff: { version: deposit.version, assetCount: deposit.assets.length },
    depositId: deposit.id,
  });
  return getDepositDetail(actor.tenantId, depositId);
}
