import Link from "next/link";
import { ActionLink, Card, DepositBadge, EmptyState, PageHeader } from "@/components/ui";
import { getPortalAgreements, getPortalDeposits } from "./actions";

export default async function DepositsPage() {
  const [deposits, agreements] = await Promise.all([
    getPortalDeposits(),
    getPortalAgreements(),
  ]);
  const vendorByAgreement = new Map(agreements.map((a) => [a.id, a.vendorName]));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Deposits"
        sub={`${deposits.length} deposit${deposits.length === 1 ? "" : "s"} · ${agreements.length} agreement${agreements.length === 1 ? "" : "s"}`}
        actions={<ActionLink href="/portal/deposits/new">New deposit</ActionLink>}
      />
      {deposits.length === 0 ? (
        <Card>
          <EmptyState
            title="No deposits yet"
            hint="Create the first draft to start the escrow flow."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="ev-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Version</th>
                <th className="text-right">Status</th>
                <th className="text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-raise/50">
                  <td>
                    <Link
                      href={`/portal/deposits/${d.id}`}
                      className="text-tx-hi transition-colors hover:text-accent"
                    >
                      {vendorByAgreement.get(d.agreementId) ?? d.agreementId}
                    </Link>
                  </td>
                  <td className="font-mono tabular-nums text-tx-mid">v{d.version}</td>
                  <td className="text-right">
                    <DepositBadge status={d.status} />
                  </td>
                  <td className="text-right font-mono text-tx-lo tabular-nums">
                    {d.createdAt.toISOString().slice(0, 10)}
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
