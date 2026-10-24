import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Providers } from "@/state/providers";

// Server-side gate for the whole portal: no valid app session (Auth0 login +
// known auth0Sub in our DB) means back to sign-in. Runs on every portal
// request; the edge middleware redirect is only a fast-path optimization.
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user?.appUserId || !user?.tenantSlug || !user?.appRole) {
    redirect("/api/auth/signin?callbackUrl=/portal");
  }
  return (
    <Providers
      tenant={{ slug: user.tenantSlug, role: user.appRole }}
    >
      {children}
    </Providers>
  );
}
