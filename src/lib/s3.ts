import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

// Single S3 client for server code. Path-style access is required for
// S3-compatible endpoints (S3Mock locally); AWS S3 accepts it too. Credentials
// are server-only — presigned URLs are minted here, never keys in the browser.
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY || "local",
    secretAccessKey: env.S3_SECRET_KEY || "local",
  },
});

export const DEPOSIT_BUCKET = env.S3_BUCKET;
