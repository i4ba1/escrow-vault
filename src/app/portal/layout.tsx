import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Providers } from "@/state/providers";

// Auth-gated subtree: no session means no static shell is possible, so opt
// the whole portal out of static-shell validation at the lowest point that
// covers it (Next 16 Cache Components). Public pages keep validating.
export const instant = false;

// Server-side gate for the whole portal: no valid app session (Auth0 login +
// known auth0Sub in our DB) means back to sign-in. Runs on every portal
// request; the edge middleware redirect is only a fast-path optimization.
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Per-request dynamic: the portal is session-gated, so it must never be
  // statically prerendered (a prerender has no session and would cache a
  // redirect/404 shell for every visitor). connection() is the Cache
  // Components escape hatch that forces on-demand rendering.
  await connection();
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
