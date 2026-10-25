import Link from "next/link";
import { ActionLink, Card, EmptyState, PageHeader, ReleaseBadge } from "@/components/ui";
import { getPortalReleases } from "./actions";

export default async function ReleasesPage() {
  const requests = await getPortalReleases();
  const active = requests.filter(
    (r) => r.status !== "DELIVERED" && r.status !== "DENIED",
  );
  return (
    <div className="space-y-4">
      <PageHeader
        title="Releases"
        sub={`${active.length} active · ${requests.length} total`}
        actions={<ActionLink href="/portal/releases/new">File a claim</ActionLink>}
      />
      {requests.length === 0 ? (
        <Card>
          <EmptyState
            title="No release claims"
            hint="Beneficiaries file here when a contractual trigger fires."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="ev-table">
            <thead>
              <tr>
                <th>Agreement</th>
                <th>Trigger</th>
                <th className="text-right">Status</th>
                <th className="text-right">Filed</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-raise/50">
                  <td>
                    <Link
                      href={`/portal/releases/${r.id}`}
                      className="text-tx-hi transition-colors hover:text-accent"
                    >
                      {r.agreement.vendorName} → {r.agreement.beneficiaryName}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-tx-mid">{r.trigger}</td>
                  <td className="text-right">
                    <ReleaseBadge status={r.status} />
                  </td>
                  <td className="text-right font-mono text-tx-lo tabular-nums">
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
