import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { RoleBadge } from "@/components/ui";
import { PortalNav } from "./nav.client";
import { signOutAction } from "./actions";

// App shell (docs/design.md §5 Nav): dark is THE surface — sidebar, content
// and landing share --bg-app so product and marketing read as one product.
// Server-side gate: no valid app session means back to sign-in; the edge
// proxy redirect is only a fast-path optimization.
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Session-gated: auth() reads the session cookie, so every portal request
  // renders on demand against its own session — never from a static shell.
  const session = await auth();
  const user = session?.user;
  if (!user?.appUserId || !user?.tenantSlug || !user?.appRole) {
    redirect("/api/auth/signin?callbackUrl=/portal");
  }
  return (
    <div className="min-h-screen bg-app lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:min-h-screen lg:flex-col lg:border-r lg:border-line lg:bg-panel">
        <div className="px-5 pt-5">
          <p className="text-[15px] font-medium tracking-tight text-tx-hi">
            Escrow<span className="text-accent">Vault</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-tx-lo">{user.tenantSlug}</p>
        </div>
        <PortalNav orientation="sidebar" />
        <div className="mt-auto p-3">
          <div className="rounded-[6px] border border-line bg-app p-3">
            <p className="truncate text-[13px] text-tx-hi">{user.email}</p>
            <div className="mt-1.5">
              <RoleBadge role={user.appRole} />
            </div>
            <form action={signOutAction} className="mt-2.5">
              <button
                type="submit"
                className="w-full cursor-pointer rounded-[6px] border border-transparent px-3 py-1.5 text-left text-[13px] text-tx-lo transition-colors hover:bg-raise hover:text-tx-hi"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Content column (+ mobile top bar) */}
      <div className="min-w-0">
        <header className="border-b border-line bg-panel lg:hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <p className="text-[15px] font-medium tracking-tight text-tx-hi">
              Escrow<span className="text-accent">Vault</span>
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer rounded-[6px] px-2 py-1 text-[13px] text-tx-lo transition-colors hover:text-tx-hi"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="px-4 pb-3">
            <PortalNav orientation="topbar" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
