"use server";

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAppSession, requireRole } from "@/lib/rbac";
import { listAgreements } from "@/services/agreements";
import {
  activateDeposit,
  createDraftDeposit,
  getDepositDetail,
  listDeposits,
} from "@/services/deposits";

// Thin Server Actions: auth + delegation. All rules live in services/ so the
// GraphQL mutations exercise byte-identical behavior.
export async function getPortalDeposits(agreementId?: string) {
  const session = await requireAppSession();
  return listDeposits(session.user.tenantId, agreementId);
}

export async function getPortalAgreements() {
  const session = await requireAppSession();
  return listAgreements(session.user.tenantId);
}

export async function getPortalDeposit(depositId: string) {
  const session = await requireAppSession();
  return getDepositDetail(session.user.tenantId, depositId);
}

export async function createDepositAction(formData: FormData) {
  const session = await requireRole(Role.DEPOSITOR);
  const agreementId = String(formData.get("agreementId") ?? "");
  const deposit = await createDraftDeposit(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    agreementId,
  );
  redirect(`/portal/deposits/${deposit.id}`);
}

export async function activateDepositAction(depositId: string) {
  const session = await requireRole(Role.DEPOSITOR);
  await activateDeposit(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    depositId,
  );
  redirect(`/portal/deposits/${depositId}`);
}
