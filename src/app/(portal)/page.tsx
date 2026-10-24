import Link from "next/link";
import { Suspense } from "react";
import { requireAppSession } from "@/lib/rbac";
import { Dashboard } from "./dashboard.client";

// Portal home: server-rendered greeting (role/tenant from the verified
// session) plus the client-side health dashboard, which queries the same
// GraphQL API the upcoming M6 Playwright suite drives.
export default async function PortalHome() {
  const session = await requireAppSession();
  const { user } = session;
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Escrow health</h1>
          <p className="text-sm text-zinc-500">
            {user.email} · {user.appRole} · {user.tenantSlug}
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/portal/deposits" className="underline underline-offset-4">
            Deposits
          </Link>
          <Link href="/portal/verification" className="underline underline-offset-4">
            Verification
          </Link>
          <Link href="/portal/audit" className="underline underline-offset-4">
            Audit
          </Link>
        </nav>
      </header>
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded border border-zinc-200 bg-zinc-50" />
            ))}
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}
