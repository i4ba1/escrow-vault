"use server";

import { redirect } from "next/navigation";
import { Role, VerificationStatus, VerificationTier } from "@prisma/client";
import { requireAppSession, requireRole } from "@/lib/rbac";
import {
  decideCertifiedRun,
  escalateRun,
  executeRun,
  getRunDetail,
  listVerificationRuns,
} from "@/services/verification";
import { InputError } from "@/services/errors";

const TIERS = Object.values(VerificationTier) as string[];

export async function getPortalRuns(statuses?: VerificationStatus[]) {
  const session = await requireAppSession();
  return listVerificationRuns(session.user.tenantId, statuses);
}

export async function getPortalRun(runId: string) {
  const session = await requireAppSession();
  return getRunDetail(session.user.tenantId, runId);
}

export async function executeRunAction(runId: string) {
  const session = await requireRole(Role.AGENT);
  await executeRun(
    session.user.tenantId,
    runId,
    session.user.appUserId,
  );
  redirect(`/portal/verification/${runId}`);
}

export async function escalateAction(depositId: string, tier: string) {
  const session = await requireRole(Role.AGENT);
  if (!TIERS.includes(tier)) {
    throw new InputError(`Unknown tier: ${tier}.`);
  }
  const run = await escalateRun(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    depositId,
    tier as VerificationTier,
  );
  redirect(`/portal/verification/${run.id}`);
}

export async function decideAction(runId: string, formData: FormData) {
  const session = await requireRole(Role.AGENT);
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");
  if (decision !== "approve" && decision !== "reject") {
    throw new InputError("Decision must be approve or reject.");
  }
  await decideCertifiedRun(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    runId,
    decision === "approve",
    note,
  );
  redirect(`/portal/verification/${runId}`);
}
