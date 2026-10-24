import "server-only";

import { PrismaClient } from "@prisma/client";

// Singleton: Next.js dev hot-reload would otherwise exhaust the Postgres
// connection pool by creating a client per module evaluation.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
