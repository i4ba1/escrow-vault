import Link from "next/link";
import { ActionLink, Card, EmptyState, PageHeader, ReleaseBadge } from "@/components/ui";
import { getPortalReleases } from "./actions";

export default async function ReleasesPage() {
  const requests = await getPortalReleases();
  const open = requests.filter(
    (r) => r.status !== "DELIVERED" && r.status !== "DENIED",
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Release requests"
        sub={`${open.length} active · ${requests.length} total`}
        actions={<ActionLink href="/portal/releases/new">File a claim</ActionLink>}
      />
      {requests.length === 0 ? (
        <EmptyState
          title="No release claims"
          hint="Beneficiaries file here when a contractual trigger fires."
          action={<ActionLink href="/portal/releases/new">File a claim</ActionLink>}
        />
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="ev-table m-5 w-[calc(100%-2.5rem)]">
            <thead>
              <tr>
                <th>Agreement</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Filed</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-stone-50">
                  <td>
                    <Link
                      href={`/portal/releases/${r.id}`}
                      className="font-medium text-emerald-800 underline-offset-4 hover:underline"
                    >
                      {r.agreement.vendorName} → {r.agreement.beneficiaryName}
                    </Link>
                  </td>
                  <td className="text-stone-600">{r.trigger}</td>
                  <td>
                    <ReleaseBadge status={r.status} />
                  </td>
                  <td className="text-stone-500 tabular-nums">
                    {r.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
