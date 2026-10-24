import { requireAppSession } from "@/lib/rbac";

// M2 shell page: proves the portal gate works. Replaced by the real dashboard
// in M4; the auth wiring it exercises (layout gate + requireAppSession) stays.
export default async function PortalHome() {
  const session = await requireAppSession();
  const { user } = session;
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">EscrowVault portal</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="font-medium">Signed in as</dt>
          <dd>{user.email ?? "(no email claim)"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Role</dt>
          <dd>{user.appRole}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Tenant</dt>
          <dd>{user.tenantSlug}</dd>
        </div>
      </dl>
    </main>
  );
}
