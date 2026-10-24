"use server";

import { requireAppSession } from "@/lib/rbac";
import { listAuditEvents } from "@/services/audit";

export async function getPortalAuditEvents(limit = 100) {
  const session = await requireAppSession();
  return listAuditEvents(session.user.tenantId, limit);
}
