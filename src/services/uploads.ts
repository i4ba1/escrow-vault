import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DEPOSIT_BUCKET, s3 } from "../lib/s3";
import { prisma } from "../lib/prisma";
import { logEvent } from "./audit";
import {
  ConflictError,
  ForbiddenError,
  InputError,
  NotFoundError,
} from "./errors";
import { DepositStatus, Role, ScanStatus, type Actor } from "./types";
import type { Asset } from "@prisma/client";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const SHA256_RE = /^[0-9a-f]{64}$/i;

export interface RequestUploadInput extends Actor {
  depositId: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
}

export interface SignedUpload {
  url: string;
  s3Key: string;
  assetId: string;
  expiresIn: number;
}

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[^\w.\-()[\] ]+/g, "_").slice(0, 180);
  if (!clean || clean === "." || clean === "..") {
    throw new InputError("Filename is not usable.");
  }
  return clean;
}

// Mints a presigned PUT URL and reserves the Asset row (scan PENDING) so the
// key can never collide and the scan worker always has an expected hash.
// Browser uploads straight to storage; AWS keys never leave the server.
export async function requestUploadUrl(
  input: RequestUploadInput,
): Promise<SignedUpload> {
  if (input.role !== Role.DEPOSITOR) {
    throw new ForbiddenError("Only depositors can upload assets.");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) {
    throw new InputError("sizeBytes must be a positive integer.");
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new InputError(
      `File exceeds the ${MAX_UPLOAD_BYTES}-byte deposit limit.`,
    );
  }
  if (!SHA256_RE.test(input.sha256)) {
    throw new InputError("sha256 must be a 64-character hex digest.");
  }
  const filename = sanitizeFilename(input.filename);

  const deposit = await prisma.deposit.findFirst({
    where: { id: input.depositId, agreement: { tenantId: input.tenantId } },
    include: { agreement: true },
  });
  if (!deposit) {
    throw new NotFoundError("Deposit not found in this tenant.");
  }
  if (
    deposit.status !== DepositStatus.DRAFT &&
    deposit.status !== DepositStatus.UPLOADING
  ) {
    throw new ConflictError(
      `Deposit is ${deposit.status}; uploads require a draft deposit.`,
    );
  }

  const s3Key = `${input.tenantId}/${deposit.id}/${Date.now()}-${filename}`;
  const asset: Asset = await prisma.asset.create({
    data: {
      depositId: deposit.id,
      type: "SOURCE",
      filename,
      s3Key,
      sizeBytes: BigInt(input.sizeBytes),
      sha256: input.sha256.toLowerCase(),
      scanStatus: ScanStatus.PENDING,
    },
  });
  if (deposit.status === DepositStatus.DRAFT) {
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: DepositStatus.UPLOADING },
    });
  }

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: DEPOSIT_BUCKET,
      Key: s3Key,
      ContentLength: input.sizeBytes,
      ContentType: "application/octet-stream",
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  await logEvent({
    tenantId: input.tenantId,
    actorId: input.userId,
    entity: "Asset",
    entityId: asset.id,
    action: "UPLOAD_URL_ISSUED",
    diff: { filename, sizeBytes: input.sizeBytes },
    depositId: deposit.id,
  });

  return { url, s3Key, assetId: asset.id, expiresIn: UPLOAD_URL_TTL_SECONDS };
}
