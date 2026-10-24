"use server";

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAppSession, requireRole } from "@/lib/rbac";
import { InputError } from "@/services/errors";
import {
  decideRelease,
  disputeClaim,
  fileClaim,
  getReleaseDetail,
  listReleaseRequests,
  notifyVendor,
  recordDelivery,
} from "@/services/releases";

// Thin Server Actions: auth + delegation. Same rules as the GraphQL
// mutations — both transports share services/releases.ts.
export async function getPortalReleases() {
  const session = await requireAppSession();
  return listReleaseRequests(session.user.tenantId);
}

export async function getPortalRelease(requestId: string) {
  const session = await requireAppSession();
  const request = await getReleaseDetail(session.user.tenantId, requestId);
  // Computed here (server action, impure calls allowed) rather than in the
  // component, whose render must stay pure (react-hooks/purity).
  const daysLeft =
    request.disputeUntil != null
      ? Math.max(
          0,
          Math.ceil((request.disputeUntil.getTime() - Date.now()) / 86_400_000),
        )
      : null;
  return { request, daysLeft };
}

export async function fileClaimAction(formData: FormData) {
  const session = await requireRole(Role.BENEFICIARY);
  const agreementId = String(formData.get("agreementId") ?? "");
  const trigger = String(formData.get("trigger") ?? "");
  const evidenceSummary = String(formData.get("evidenceSummary") ?? "");
  const ticketsRaw = String(formData.get("evidenceTickets") ?? "");
  const tickets = ticketsRaw
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const request = await fileClaim(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    agreementId,
    trigger,
    evidenceSummary,
    tickets,
  );
  redirect(`/portal/releases/${request.id}`);
}

export async function notifyAction(requestId: string) {
  const session = await requireRole(Role.AGENT);
  await notifyVendor(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    requestId,
  );
  redirect(`/portal/releases/${requestId}`);
}

export async function disputeAction(requestId: string, formData: FormData) {
  const session = await requireAppSession();
  if (session.user.appRole !== Role.DEPOSITOR && session.user.appRole !== Role.AGENT) {
    throw new InputError("Only the vendor side can dispute a claim.");
  }
  await disputeClaim(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    requestId,
    String(formData.get("note") ?? ""),
  );
  redirect(`/portal/releases/${requestId}`);
}

export async function decideAction(requestId: string, formData: FormData) {
  const session = await requireRole(Role.AGENT);
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approve" && decision !== "deny") {
    throw new InputError("Decision must be approve or deny.");
  }
  await decideRelease(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    requestId,
    decision === "approve",
    String(formData.get("rationale") ?? ""),
  );
  redirect(`/portal/releases/${requestId}`);
}

export async function deliverAction(requestId: string, formData: FormData) {
  const session = await requireRole(Role.AGENT);
  await recordDelivery(
    {
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
    },
    requestId,
    String(formData.get("handoverRef") ?? ""),
  );
  redirect(`/portal/releases/${requestId}`);
}
