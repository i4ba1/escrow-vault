import Link from "next/link";
import { getPortalReleases } from "./actions";

export default async function ReleasesPage() {
  const requests = await getPortalReleases();
  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Release requests</h1>
        <Link
          href="/portal/releases/new"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          File a claim
        </Link>
      </div>
      {requests.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No release claims. Beneficiaries file here when a contractual trigger fires.
        </p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b text-zinc-500">
              <th className="py-2 pr-4 font-medium">Agreement</th>
              <th className="py-2 pr-4 font-medium">Trigger</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Filed</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link
                    href={`/portal/releases/${r.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {r.agreement.vendorName} → {r.agreement.beneficiaryName}
                  </Link>
                </td>
                <td className="py-2 pr-4">{r.trigger}</td>
                <td className="py-2 pr-4">{r.status}</td>
                <td className="py-2 text-zinc-500">
                  {r.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
