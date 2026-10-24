import { Suspense } from "react";
import { requireAppSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { Dashboard } from "./dashboard.client";

// Portal home: server-rendered greeting (role/tenant from the verified
// session) plus the client-side health dashboard, which queries the same
// GraphQL API the Playwright suite drives.
export default async function PortalHome() {
  const session = await requireAppSession();
  const { user } = session;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Escrow health"
        sub={`${user.email} · ${user.appRole} · ${user.tenantSlug}`}
      />
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-stone-200 bg-white" />
            ))}
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </div>
  );
}
