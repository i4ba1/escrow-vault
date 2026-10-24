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
    <div className="space-y-5">
      <PageHeader
        title="Deposits"
        sub={`${deposits.length} deposit${deposits.length === 1 ? "" : "s"} across ${agreements.length} agreement${agreements.length === 1 ? "" : "s"}`}
        actions={<ActionLink href="/portal/deposits/new">New deposit</ActionLink>}
      />
      {deposits.length === 0 ? (
        <EmptyState
          title="No deposits yet"
          hint="Create the first draft to start the escrow flow."
          action={<ActionLink href="/portal/deposits/new">New deposit</ActionLink>}
        />
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="ev-table m-5 w-[calc(100%-2.5rem)]">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Version</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-stone-50">
                  <td>
                    <Link
                      href={`/portal/deposits/${d.id}`}
                      className="font-medium text-emerald-800 underline-offset-4 hover:underline"
                    >
                      {vendorByAgreement.get(d.agreementId) ?? d.agreementId}
                    </Link>
                  </td>
                  <td className="tabular-nums">v{d.version}</td>
                  <td>
                    <DepositBadge status={d.status} />
                  </td>
                  <td className="text-stone-500 tabular-nums">
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
