import "server-only";

import { auth } from "@/auth";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../services/errors";

export { ForbiddenError, UnauthorizedError };

export interface AppSessionUser {
  appUserId: string;
  appRole: Role;
  tenantId: string;
  tenantSlug: string;
}

// Authoritative session check for Server Components, Server Actions and Route
// Handlers. The edge middleware only does a coarse cookie-presence redirect;
// every data access re-verifies here. Never trust role/tenantId from client input.
export async function requireAppSession(): Promise<Session> {
  const session = await auth();
  const user = session?.user;
  if (
    !session ||
    !user?.appUserId ||
    !user?.appRole ||
    !user?.tenantId ||
    !user?.tenantSlug
  ) {
    throw new UnauthorizedError();
  }
  return session;
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireAppSession();
  if (!roles.includes(session.user.appRole)) {
    throw new ForbiddenError(
      `Requires one of: ${roles.join(", ")}. Current role: ${session.user.appRole}.`,
    );
  }
  return session;
}
