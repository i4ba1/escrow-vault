import { PrismaClient } from "@prisma/client";

// NOTE: intentionally no `server-only` import here. Services that use this
// client are runtime-agnostic on purpose so tsx scripts (seed, scan worker,
// smoke tests) can import them; the request boundary is enforced by rbac.ts
// (which does import server-only) and by code review.

// Singleton: Next.js dev hot-reload would otherwise exhaust the Postgres
// connection pool by creating a client per module evaluation.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
