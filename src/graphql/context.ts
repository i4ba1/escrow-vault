import DataLoader from "dataloader";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface ContextActor {
  tenantId: string;
  userId: string;
  role: Role;
}

export interface AppContext extends ContextActor {
  loaders: {
    assetsByDepositId: DataLoader<string, AssetRow[]>;
    runsByDepositId: DataLoader<string, RunRow[]>;
  };
}

type AssetRow = {
  id: string;
  depositId: string;
  type: string;
  filename: string;
  sizeBytes: bigint;
  sha256: string;
  scanStatus: string;
};

type RunRow = {
  id: string;
  depositId: string;
  tier: string;
  status: string;
  findings: unknown;
  completedAt: Date | null;
  certificate: { id: string; tier: string; serialNo: string; issuedAt: Date } | null;
};

async function batchAssets(ids: readonly string[]): Promise<AssetRow[][]> {
  const rows = (await prisma.asset.findMany({
    where: { depositId: { in: [...ids] } },
    orderBy: { createdAt: "asc" },
  })) as AssetRow[];
  const byId = new Map<string, AssetRow[]>();
  for (const id of ids) byId.set(id, []);
  for (const row of rows) byId.get(row.depositId)?.push(row);
  return ids.map((id) => byId.get(id) ?? []);
}

async function batchRuns(ids: readonly string[]): Promise<RunRow[][]> {
  const rows = (await prisma.verificationRun.findMany({
    where: { depositId: { in: [...ids] } },
    include: { certificate: true },
    orderBy: { createdAt: "desc" },
  })) as RunRow[];
  const byId = new Map<string, RunRow[]>();
  for (const id of ids) byId.set(id, []);
  for (const row of rows) byId.get(row.depositId)?.push(row);
  return ids.map((id) => byId.get(id) ?? []);
}

// Per-request context: tenant isolation + role travel with every resolver,
// and DataLoaders (request-scoped cache) kill the assets/runs N+1 on list
// queries. Constructed from the verified session — never from client input.
export function createAppContext(actor: ContextActor): AppContext {
  return {
    ...actor,
    loaders: {
      assetsByDepositId: new DataLoader(batchAssets),
      runsByDepositId: new DataLoader(batchRuns),
    },
  };
}
