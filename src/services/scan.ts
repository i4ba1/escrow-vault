import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { DEPOSIT_BUCKET, s3 } from "../lib/s3";
import { prisma } from "../lib/prisma";
import { logEvent } from "./audit";

export interface ScanSummary {
  checked: number;
  passed: number;
  failed: number;
  runsCreated: number;
}

async function sha256Of(key: string): Promise<{ hash: string; size: number }> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: DEPOSIT_BUCKET, Key: key }),
  );
  const body = res.Body;
  if (!body || typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] !== "function") {
    throw new Error(`No readable body for s3://${DEPOSIT_BUCKET}/${key}`);
  }
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    hash.update(chunk);
  }
  return { hash: hash.digest("hex"), size };
}

// Integrity scan: for every PENDING asset, re-download the object, recompute
// sha256 + size, and compare against the values declared at sign time.
// PASS assets unblock activation; FAIL assets carry the reason in the audit
// timeline. When a deposit's assets are all PASS, a Validated run is queued
// (M4 executes the tier checks). Shared by the Lambda (aws/) and the local
// stub (scripts/lambda-stub.ts).
export async function scanPendingAssets(): Promise<ScanSummary> {
  const pending = await prisma.asset.findMany({
    where: { scanStatus: "PENDING" },
    include: { deposit: { include: { agreement: true } } },
    orderBy: { createdAt: "asc" },
  });

  const summary: ScanSummary = {
    checked: pending.length,
    passed: 0,
    failed: 0,
    runsCreated: 0,
  };
  const touchedDeposits = new Set<string>();

  for (const asset of pending) {
    const tenantId = asset.deposit.agreement.tenantId;
    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: DEPOSIT_BUCKET, Key: asset.s3Key }),
      );
      const { hash, size } = await sha256Of(asset.s3Key);
      const sizeOk = head.ContentLength === Number(asset.sizeBytes) && size === Number(asset.sizeBytes);
      const hashOk = hash === asset.sha256.toLowerCase();
      if (sizeOk && hashOk) {
        await prisma.asset.update({
          where: { id: asset.id },
          data: { scanStatus: "PASS" },
        });
        summary.passed += 1;
        await logEvent({
          tenantId,
          entity: "Asset",
          entityId: asset.id,
          action: "SCAN_PASS",
          diff: { sizeBytes: size },
          depositId: asset.depositId,
        });
      } else {
        throw new Error(
          `mismatch (sizeOk=${sizeOk}, hashOk=${hashOk}, expected=${asset.sha256}, actual=${hash})`,
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await prisma.asset.update({
        where: { id: asset.id },
        data: { scanStatus: "FAIL" },
      });
      summary.failed += 1;
      await logEvent({
        tenantId,
        entity: "Asset",
        entityId: asset.id,
        action: "SCAN_FAIL",
        diff: { reason },
        depositId: asset.depositId,
      });
    }
    touchedDeposits.add(asset.depositId);
  }

  for (const depositId of touchedDeposits) {
    const remaining = await prisma.asset.count({
      where: { depositId, scanStatus: { not: "PASS" } },
    });
    if (remaining > 0) continue;
    const existing = await prisma.verificationRun.findFirst({
      where: { depositId, tier: "VALIDATED" },
    });
    if (existing) continue;
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: { agreement: true },
    });
    if (!deposit) continue;
    const run = await prisma.verificationRun.create({
      data: { depositId, tier: "VALIDATED", status: "QUEUED" },
    });
    summary.runsCreated += 1;
    await logEvent({
      tenantId: deposit.agreement.tenantId,
      entity: "VerificationRun",
      entityId: run.id,
      action: "QUEUED",
      diff: { tier: "VALIDATED" },
      depositId,
      verificationRunId: run.id,
    });
  }

  return summary;
}
