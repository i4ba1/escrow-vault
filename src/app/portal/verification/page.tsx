import Link from "next/link";
import {
  Card,
  EmptyState,
  PageHeader,
  RunBadge,
  TierBadge,
} from "@/components/ui";
import { getPortalRuns } from "./actions";

interface QueueRow {
  id: string;
  tier: string;
  status: string;
  deposit: { agreement: { vendorName: string }; version: number };
}

// Agent work queue: open runs first, then history. Depositors/beneficiaries
// see the same read-only queue (their layout gate already passed); actions
// re-check the AGENT role server-side.
export default async function VerificationPage() {
  const runs = await getPortalRuns();
  const open = runs.filter((r) => r.status === "QUEUED" || r.status === "RUNNING");
  const done = runs.filter((r) => r.status !== "QUEUED" && r.status !== "RUNNING");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Verification"
        sub={`${open.length} open · ${done.length} completed`}
      />
      <Card title={`Open runs (${open.length})`}>
        {open.length === 0 ? (
          <EmptyState title="Queue is empty" hint="New runs appear once deposits finish scanning." />
        ) : (
          <RunTable runs={open} />
        )}
      </Card>
      <Card title={`History (${done.length})`}>
        {done.length === 0 ? (
          <p className="text-sm text-stone-500">No completed runs yet.</p>
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
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-stone-50">
              <td>
                <Link
                  href={`/portal/verification/${r.id}`}
                  className="font-medium text-emerald-800 underline-offset-4 hover:underline"
                >
                  {r.deposit.agreement.vendorName} v{r.deposit.version}
                </Link>
              </td>
              <td>
                <TierBadge tier={r.tier} />
              </td>
              <td>
                <RunBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
