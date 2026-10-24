import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
import {
  decideAction,
  deliverAction,
  disputeAction,
  getPortalRelease,
  notifyAction,
} from "../actions";

// Claim lifecycle console: every control renders only for the role + state
// combination allowed to use it; the service re-enforces both server-side.
export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAppSession();
  const found = await getPortalRelease(id).catch(() => null);
  if (!found) notFound();
  const { request, daysLeft } = found;

  const role = session.user.appRole;
  const evidence = (request.evidence as {
    summary?: string;
    tickets?: string[];
    dispute?: { note?: string; at?: string };
  } | null) ?? {};


  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header>
        <p className="text-sm text-zinc-500">
          {request.agreement.vendorName} → {request.agreement.beneficiaryName}
        </p>
        <h1 className="text-2xl font-bold">
          {request.trigger} · {request.status}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Filed by {request.filedBy.email} ·{" "}
          {request.createdAt.toISOString().slice(0, 10)}
        </p>
      </header>

      <section className="rounded border border-zinc-200 p-4 text-sm">
        <h2 className="font-semibold">Evidence</h2>
        <p className="mt-1">{evidence.summary ?? "(none)"}</p>
        {(evidence.tickets ?? []).length > 0 && (
          <p className="mt-1 text-zinc-500">
            Tickets: {evidence.tickets!.join(", ")}
          </p>
        )}
        {evidence.dispute && (
          <div className="mt-2 border-t pt-2">
            <p className="font-medium">Vendor counter-evidence</p>
            <p>{evidence.dispute.note}</p>
          </div>
        )}
      </section>

      {request.status === "NOTIFIED" && daysLeft != null && (
        <p className="text-sm text-amber-700">
          Dispute window: {daysLeft} day(s) remaining
          {request.notifiedBy ? ` · notified by ${request.notifiedBy.email}` : ""}.
        </p>
      )}

      {request.status === "FILED" && role === "AGENT" && (
        <form
          action={async () => {
            "use server";
            await notifyAction(request.id);
          }}
          className="rounded border border-zinc-200 p-4 text-sm"
        >
          <h2 className="font-semibold">Accept for processing</h2>
          <p className="mt-1 text-zinc-500">
            Notifies the vendor and opens the contractual dispute window.
            You will be recorded as notifier — and therefore barred from
            deciding this claim (maker-checker).
          </p>
          <button
            type="submit"
            className="mt-3 rounded bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
          >
            Notify vendor
          </button>
        </form>
      )}

      {request.status === "NOTIFIED" &&
        (role === "DEPOSITOR" || role === "AGENT") && (
          <form
            action={disputeAction.bind(null, request.id)}
            className="rounded border border-zinc-200 p-4 text-sm"
          >
            <h2 className="font-semibold">Dispute this claim</h2>
            <label className="mt-2 block">
              <span className="font-medium">Counter-evidence</span>
              <textarea
                name="note"
                required
                rows={3}
                className="mt-1 block w-full rounded border border-zinc-300 p-2"
              />
            </label>
            <button
              type="submit"
              className="mt-3 rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500"
            >
              File dispute
            </button>
          </form>
        )}

      {(request.status === "DISPUTED" || request.status === "UNDISPUTED") &&
        role === "AGENT" && (
          <form
            action={decideAction.bind(null, request.id)}
            className="rounded border border-zinc-200 p-4 text-sm"
          >
            <h2 className="font-semibold">Decide this claim</h2>
            <p className="mt-1 text-zinc-500">
              Maker-checker enforced: you may not decide if you filed or
              notified this claim.
            </p>
            <label className="mt-2 block">
              <span className="font-medium">Rationale</span>
              <textarea
                name="rationale"
                required
                rows={3}
                className="mt-1 block w-full rounded border border-zinc-300 p-2"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                name="decision"
                value="approve"
                className="rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-600"
              >
                Approve release
              </button>
              <button
                type="submit"
                name="decision"
                value="deny"
                className="rounded bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-600"
              >
                Deny
              </button>
            </div>
          </form>
        )}

      {request.status === "APPROVED" && role === "AGENT" && (
        <form
          action={deliverAction.bind(null, request.id)}
          className="rounded border border-green-300 bg-green-50 p-4 text-sm"
        >
          <h2 className="font-semibold text-green-900">Record secure delivery</h2>
          <label className="mt-2 block">
            <span className="font-medium">Handover reference</span>
            <input
              name="handoverRef"
              required
              maxLength={500}
              placeholder="e.g. encrypted vault transfer #4821, confirmed by beneficiary"
              className="mt-1 block w-full rounded border border-zinc-300 p-2"
            />
          </label>
          <button
            type="submit"
            className="mt-3 rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-600"
          >
            Mark delivered
          </button>
        </form>
      )}

      {request.status === "DELIVERED" && (
        <p className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          Delivered{request.deliveryNote ? `: ${request.deliveryNote}` : "."}
          {request.decidedBy ? ` Decided by ${request.decidedBy.email}.` : ""}
        </p>
      )}
      {request.status === "DENIED" && (
        <p className="rounded border border-zinc-200 p-4 text-sm text-zinc-600">
          Claim denied{request.decidedBy ? ` by ${request.decidedBy.email}` : ""}.
        </p>
      )}
    </main>
  );
}
