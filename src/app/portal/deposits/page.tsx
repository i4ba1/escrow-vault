import Link from "next/link";
import { getPortalAgreements, getPortalDeposits } from "./actions";

export default async function DepositsPage() {
  const [deposits, agreements] = await Promise.all([
    getPortalDeposits(),
    getPortalAgreements(),
  ]);
  const vendorByAgreement = new Map(agreements.map((a) => [a.id, a.vendorName]));
  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deposits</h1>
        <Link
          href="/portal/deposits/new"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New deposit
        </Link>
      </div>
      {deposits.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No deposits yet. Create the first draft to start the escrow flow.
        </p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b text-zinc-500">
              <th className="py-2 pr-4 font-medium">Vendor</th>
              <th className="py-2 pr-4 font-medium">Version</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link
                    href={`/portal/deposits/${d.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {vendorByAgreement.get(d.agreementId) ?? d.agreementId}
                  </Link>
                </td>
                <td className="py-2 pr-4">v{d.version}</td>
                <td className="py-2 pr-4">
                  <StatusPill status={d.status} />
                </td>
                <td className="py-2 text-zinc-500">
                  {d.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-green-100 text-green-800"
      : status === "DRAFT" || status === "UPLOADING"
        ? "bg-amber-100 text-amber-800"
        : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}
