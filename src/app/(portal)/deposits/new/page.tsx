import { createDepositAction, getPortalAgreements } from "../actions";

// Deposit wizard, step 1: pick an ACTIVE agreement → creates a DRAFT deposit
// at max(version)+1 and lands on its detail page for uploads (step 2).
export default async function NewDepositPage() {
  const agreements = await getPortalAgreements();
  const active = agreements.filter((a) => a.status === "ACTIVE");
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">New deposit</h1>
      {active.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No ACTIVE agreements in this tenant. Activate an agreement before
          depositing.
        </p>
      ) : (
        <form action={createDepositAction} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium">Escrow agreement</span>
            <select
              name="agreementId"
              required
              className="mt-1 block w-full rounded border border-zinc-300 p-2"
            >
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.vendorName} → {a.beneficiaryName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Create draft deposit
          </button>
        </form>
      )}
    </main>
  );
}
