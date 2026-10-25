import Link from "next/link";
import { Card, EmptyState, PageHeader, RunBadge, TierBadge } from "@/components/ui";
import { getPortalRuns } from "./actions";

interface QueueRow {
  id: string;
  tier: string;
  status: string;
  deposit: { agreement: { vendorName: string }; version: number };
}

// Verification queue (docs/design.md §6): open runs first, then history.
// Role-specific actions re-check server-side; the queue itself is read-only.
export default async function VerificationPage() {
  const runs = await getPortalRuns();
  const open = runs.filter((r) => r.status === "QUEUED" || r.status === "RUNNING");
  const done = runs.filter((r) => r.status !== "QUEUED" && r.status !== "RUNNING");
  return (
    <div className="space-y-4">
      <PageHeader title="Verification" sub={`${open.length} open · ${done.length} done`} />
      <Card title="Open runs">
        {open.length === 0 ? (
          <EmptyState title="Queue is empty" hint="New runs appear once deposits finish scanning." />
        ) : (
          <RunTable runs={open} />
        )}
      </Card>
      <Card title="History">
        {done.length === 0 ? (
          <p className="text-[13px] text-tx-lo">No completed runs yet.</p>
        ) : (
          <RunTable runs={done} />
        )}
      </Card>
    </div>
  );
}

function RunTable({ runs }: { runs: QueueRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="ev-table">
        <thead>
          <tr>
            <th>Deposit</th>
            <th>Tier</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-raise/50">
              <td>
                <Link
                  href={`/portal/verification/${r.id}`}
                  className="text-tx-hi transition-colors hover:text-accent"
                >
                  {r.deposit.agreement.vendorName}{" "}
                  <span className="font-mono text-xs text-tx-mid">
                    v{r.deposit.version}
                  </span>
                </Link>
              </td>
              <td>
                <TierBadge tier={r.tier} />
              </td>
              <td className="text-right">
                <RunBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
