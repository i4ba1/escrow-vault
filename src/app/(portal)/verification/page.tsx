import Link from "next/link";
import { getPortalRuns } from "./actions";

// Agent work queue: open runs first, then history. Depositors/beneficiaries
// see the same read-only queue (their layout gate already passed); actions
// re-check the AGENT role server-side.
export default async function VerificationPage() {
  const runs = await getPortalRuns();
  const open = runs.filter((r) => r.status === "QUEUED" || r.status === "RUNNING");
  const done = runs.filter((r) => r.status !== "QUEUED" && r.status !== "RUNNING");
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <h1 className="text-2xl font-bold">Verification</h1>
      <section>
        <h2 className="font-semibold">Open runs ({open.length})</h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Queue is empty.</p>
        ) : (
          <RunTable runs={open} />
        )}
      </section>
      <section>
        <h2 className="font-semibold">History ({done.length})</h2>
        {done.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No completed runs yet.</p>
        ) : (
          <RunTable runs={done} />
        )}
      </section>
    </main>
  );
}

function RunTable({
  runs,
}: {
  runs: { id: string; tier: string; status: string; deposit: { agreement: { vendorName: string }; version: number } }[];
}) {
  return (
    <table className="mt-2 w-full text-left text-sm">
      <thead>
        <tr className="border-b text-zinc-500">
          <th className="py-2 pr-4 font-medium">Deposit</th>
          <th className="py-2 pr-4 font-medium">Tier</th>
          <th className="py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="border-b last:border-0">
            <td className="py-2 pr-4">
              <Link
                href={`/portal/verification/${r.id}`}
                className="font-medium underline underline-offset-4"
              >
                {r.deposit.agreement.vendorName} v{r.deposit.version}
              </Link>
            </td>
            <td className="py-2 pr-4">{r.tier}</td>
            <td className="py-2">{r.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
