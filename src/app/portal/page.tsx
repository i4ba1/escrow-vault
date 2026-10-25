import { Suspense } from "react";
import { requireAppSession } from "@/lib/rbac";
import { Dashboard } from "./dashboard.client";

// Portal overview: server-rendered greeting (verified session) + client
// dashboard (§6) which queries the same GraphQL API the e2e suite drives.
export default async function PortalHome() {
  const session = await requireAppSession();
  const { user } = session;
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-tx-lo">
        {user.email} · {user.appRole} · <span className="font-mono">{user.tenantSlug}</span>
      </p>
      <Suspense fallback={<SkeletonFallback />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

function SkeletonFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-20 animate-pulse rounded-[6px] border border-line bg-panel" />
      <div className="h-56 animate-pulse rounded-[6px] border border-line bg-panel" />
    </div>
  );
}
