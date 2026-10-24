import { getPortalAgreements } from "../../deposits/actions";
import { fileClaimAction } from "../actions";

// Beneficiary claim form: agreement + one of its contractual triggers +
// evidence. Unknown triggers are rejected server-side.
export default async function NewClaimPage() {
  const agreements = await getPortalAgreements();
  const active = agreements.filter((a) => a.status === "ACTIVE");
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">File a release claim</h1>
      {active.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No ACTIVE agreements in this tenant.
        </p>
      ) : (
        <ClaimForm agreementIds={active.map((a) => a.id)} vendors={Object.fromEntries(active.map((a) => [a.id, `${a.vendorName} → ${a.beneficiaryName}`]))} />
      )}
    </main>
  );
}

function ClaimForm({ agreementIds, vendors }: { agreementIds: string[]; vendors: Record<string, string> }) {
  return (
    <form action={fileClaimAction} className="mt-6 space-y-4 text-sm">
      <label className="block">
        <span className="font-medium">Escrow agreement</span>
        <select
          name="agreementId"
          required
          className="mt-1 block w-full rounded border border-zinc-300 p-2"
        >
          {agreementIds.map((id) => (
            <option key={id} value={id}>
              {vendors[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-medium">Release trigger</span>
        <select
          name="trigger"
          required
          className="mt-1 block w-full rounded border border-zinc-300 p-2"
        >
          <option value="INSOLVENCY">Vendor insolvency / bankruptcy</option>
          <option value="CESSATION">Cessation of operations</option>
          <option value="SUPPORT_FAILURE">Failure to provide support</option>
          <option value="BREACH">Material breach of license</option>
          <option value="OWNERSHIP_CHANGE">Ownership change</option>
          <option value="END_OF_LIFE">End-of-life announcement</option>
          <option value="SLA_BREACH">Persistent SLA breach</option>
        </select>
      </label>
      <label className="block">
        <span className="font-medium">Evidence summary</span>
        <textarea
          name="evidenceSummary"
          required
          rows={4}
          placeholder="What happened, with dates and references"
          className="mt-1 block w-full rounded border border-zinc-300 p-2"
        />
      </label>
      <label className="block">
        <span className="font-medium">Ticket references (one per line)</span>
        <textarea
          name="evidenceTickets"
          rows={2}
          placeholder="SUP-1042"
          className="mt-1 block w-full rounded border border-zinc-300 p-2"
        />
      </label>
      <button
        type="submit"
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
      >
        File claim
      </button>
    </form>
  );
}
