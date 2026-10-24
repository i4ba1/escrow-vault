import { Card, PageHeader } from "@/components/ui";
import { createDepositAction, getPortalAgreements } from "../actions";

// Deposit wizard, step 1: pick an ACTIVE agreement → creates a DRAFT deposit
// at max(version)+1 and lands on its detail page for uploads (step 2).
export default async function NewDepositPage() {
  const agreements = await getPortalAgreements();
  const active = agreements.filter((a) => a.status === "ACTIVE");
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="New deposit"
        sub="Step 1 of 2 — choose the escrow agreement this deposit belongs to."
      />
      {active.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-500">
            No ACTIVE agreements in this tenant. Activate an agreement before
            depositing.
          </p>
        </Card>
      ) : (
        <Card title="Escrow agreement">
          <form action={createDepositAction} className="space-y-4">
            <label className="field">
              <span>Agreement</span>
              <select name="agreementId" required defaultValue={active[0].id}>
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.vendorName} → {a.beneficiaryName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary">
              Create draft deposit
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
