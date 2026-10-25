import { Card, PageHeader } from "@/components/ui";
import { getPortalAgreements } from "../../deposits/actions";
import { fileClaimAction } from "../actions";

const TRIGGERS = [
  ["INSOLVENCY", "Vendor insolvency / bankruptcy"],
  ["CESSATION", "Cessation of operations"],
  ["SUPPORT_FAILURE", "Failure to provide support"],
  ["BREACH", "Material breach of license"],
  ["OWNERSHIP_CHANGE", "Ownership change"],
  ["END_OF_LIFE", "End-of-life announcement"],
  ["SLA_BREACH", "Persistent SLA breach"],
] as const;

// Beneficiary claim form (docs/design.md §6): agreement + contractual trigger
// + evidence. Unknown triggers are rejected server-side.
export default async function NewClaimPage() {
  const agreements = await getPortalAgreements();
  const active = agreements.filter((a) => a.status === "ACTIVE");
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="File a release claim" sub="Cite a trigger, attach evidence." />
      {active.length === 0 ? (
        <Card>
          <p className="text-[13px] text-tx-mid">No ACTIVE agreements in this tenant.</p>
        </Card>
      ) : (
        <Card title="Claim">
          <form action={fileClaimAction} className="space-y-4">
            <label className="field">
              <span>Escrow agreement</span>
              <select name="agreementId" required defaultValue={active[0].id}>
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.vendorName} → {a.beneficiaryName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Release trigger</span>
              <select name="trigger" required defaultValue="SUPPORT_FAILURE">
                {TRIGGERS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Evidence summary</span>
              <textarea
                name="evidenceSummary"
                required
                rows={4}
                placeholder="What happened, with dates and references"
              />
            </label>
            <label className="field">
              <span>Ticket references (one per line)</span>
              <textarea name="evidenceTickets" rows={2} placeholder="SUP-1042" />
            </label>
            <button type="submit" className="btn-primary">
              File claim
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
