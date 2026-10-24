import { z } from "zod";

// Validated at import time: the app fails fast at boot with a field-level
// message instead of throwing deep inside a request. Auth0 credentials stay
// optional here so `next build` and local flows that don't touch sign-in work
// without them; auth.ts registers the Auth0 provider only when all three are
// present (see .env.example).
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_AUTH0_ID: z.string().optional(),
  AUTH_AUTH0_SECRET: z.string().optional(),
  AUTH_AUTH0_ISSUER: z.string().optional(),
  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT is required"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().min(1, "S3_REGION is required"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().min(1, "NEXT_PUBLIC_APP_URL is required"),
});

export const env = {
  ...serverSchema.parse(process.env),
  ...publicSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }),
};
