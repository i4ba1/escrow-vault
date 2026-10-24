import { prisma } from "../lib/prisma";
import type { Agreement } from "@prisma/client";

export async function listAgreements(
  tenantId: string,
): Promise<Agreement[]> {
  return prisma.agreement.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}
