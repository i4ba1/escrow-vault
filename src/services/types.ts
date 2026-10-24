// Shared service-layer primitives. Enums are re-exported as values so service
// signatures stay identical between the app and tsx scripts; Actor keeps the
// explicit caller identity every service rule requires (tenant isolation and
// RBAC are enforced on these fields, never on client input).
export { DepositStatus, Role, ScanStatus } from "@prisma/client";
import type { Role as RoleType } from "@prisma/client";

export interface Actor {
  tenantId: string;
  userId: string;
  role: RoleType;
}
