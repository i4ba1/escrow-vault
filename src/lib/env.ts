import { z } from "zod";

// Validated at import time: the app fails fast at boot with a field-level
// message instead of throwing deep inside a request. Auth0 credentials stay
// optional here so `next build` and local flows that don't touch sign-in work
// without them; requireAuth0() enforces them at the auth boundary instead.
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

export interface Auth0Config {
  clientId: string;
  clientSecret: string;
  issuer: string;
}

// Call at the auth boundary (auth.ts). Throws a human-readable error when the
// Auth0 tenant hasn't been wired up yet — see .env.example.
export function requireAuth0(): Auth0Config {
  const { AUTH_AUTH0_ID, AUTH_AUTH0_SECRET, AUTH_AUTH0_ISSUER } = env;
  if (!AUTH_AUTH0_ID || !AUTH_AUTH0_SECRET || !AUTH_AUTH0_ISSUER) {
    throw new Error(
      "Auth0 is not configured. Set AUTH_AUTH0_ID, AUTH_AUTH0_SECRET and " +
        "AUTH_AUTH0_ISSUER (see .env.example).",
    );
  }
  return {
    clientId: AUTH_AUTH0_ID,
    clientSecret: AUTH_AUTH0_SECRET,
    issuer: AUTH_AUTH0_ISSUER,
  };
}
