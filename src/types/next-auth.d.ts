import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// App identity resolved server-side in auth.ts callbacks (jwt → session).
// Client components must treat these as display values only; authorization
// always re-checks via requireAppSession()/requireRole() on the server.
declare module "next-auth" {
  interface Session {
    user: {
      appUserId: string;
      appRole: Role;
      tenantId: string;
      tenantSlug: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    appRole?: Role;
    tenantId?: string;
    tenantSlug?: string;
  }
}

export {};
