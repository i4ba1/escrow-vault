"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@prisma/client";

export interface TenantInfo {
  slug: string;
  role: Role;
}

const TenantContext = createContext<TenantInfo | null>(null);

// Client-safe tenant/role snapshot, seeded once from the server layout after
// auth(). Components needing live session state use next-auth's useSession().
export function useTenant(): TenantInfo {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within <Providers>.");
  }
  return ctx;
}

export function Providers({
  tenant,
  children,
}: {
  tenant: TenantInfo;
  children: ReactNode;
}) {
  return (
    <SessionProvider>
      <TenantContext.Provider value={tenant}>
        {children}
      </TenantContext.Provider>
    </SessionProvider>
  );
}
