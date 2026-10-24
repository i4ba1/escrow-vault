import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { RoleBadge } from "@/components/ui";
import { PortalNav } from "./nav.client";
import { signOutAction } from "./actions";

// Server-side gate for the whole portal: no valid app session (Auth0 login +
// known auth0Sub in our DB) means back to sign-in. Runs on every portal
// request; the edge proxy redirect is only a fast-path optimization.
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Session-gated: auth() reads the session cookie, which opts the whole
  // subtree out of static rendering — every portal request renders
  // on demand against its own session. (An explicit connection() call here
  // is wrong: outside <Suspense> it fails the prerender check instead of
  // opting out.)
  const session = await auth();
  const user = session?.user;
  if (!user?.appUserId || !user?.tenantSlug || !user?.appRole) {
    redirect("/api/auth/signin?callbackUrl=/portal");
  }
  return (
    <div className="min-h-screen bg-stone-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 lg:flex">
        <div className="px-5 pt-6">
          <p className="text-lg font-bold tracking-tight text-white">
            Escrow<span className="text-emerald-400">Vault</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{user.tenantSlug}</p>
        </div>
        <PortalNav orientation="sidebar" />
        <div className="mt-auto p-4">
          <div className="rounded-xl bg-white/5 p-3 text-sm">
            <p className="truncate font-medium text-slate-100">{user.email}</p>
            <div className="mt-1.5">
              <RoleBadge role={user.appRole} />
            </div>
            <form action={signOutAction} className="mt-3">
              <button
                type="submit"
                className="w-full cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Content column (+ mobile top bar) */}
      <div className="min-w-0 flex-1">
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <p className="font-bold tracking-tight text-stone-950">
              Escrow<span className="text-emerald-700">Vault</span>
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:text-stone-900"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="px-4 pb-3">
            <PortalNav orientation="topbar" />
          </div>
        </header>
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
