import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
import { Card, PageHeader, ReleaseBadge } from "@/components/ui";
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
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={`${request.trigger}`}
        sub={`${request.agreement.vendorName} → ${request.agreement.beneficiaryName} · filed by ${request.filedBy.email} · ${request.createdAt.toISOString().slice(0, 10)}`}
        actions={<ReleaseBadge status={request.status} />}
      />

      <Card title="Evidence">
        <p className="text-sm text-stone-800">{evidence.summary ?? "(none)"}</p>
        {(evidence.tickets ?? []).length > 0 && (
          <p className="mt-1 font-mono text-xs text-stone-500">
            {evidence.tickets!.join(", ")}
          </p>
        )}
        {evidence.dispute && (
          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
            <p className="font-semibold text-orange-900">Vendor counter-evidence</p>
            <p className="mt-0.5 text-orange-900/80">{evidence.dispute.note}</p>
          </div>
        )}
      </Card>

      {request.status === "NOTIFIED" && daysLeft != null && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Dispute window: <strong>{daysLeft} day(s) remaining</strong>
          {request.notifiedBy ? ` · notified by ${request.notifiedBy.email}` : ""}.
        </div>
      )}

      {request.status === "FILED" && role === "AGENT" && (
        <Card
          title="Accept for processing"
          sub="Notifies the vendor and opens the contractual dispute window. You will be recorded as notifier — and therefore barred from deciding this claim (maker-checker)."
        >
          <form
            action={async () => {
              "use server";
              await notifyAction(request.id);
            }}
          >
            <button type="submit" className="btn-primary">
              Notify vendor
            </button>
          </form>
        </Card>
      )}

      {request.status === "NOTIFIED" &&
        (role === "DEPOSITOR" || role === "AGENT") && (
          <Card title="Dispute this claim">
            <form action={disputeAction.bind(null, request.id)} className="space-y-3 text-sm">
              <label className="field">
                <span>Counter-evidence</span>
                <textarea name="note" required rows={3} />
              </label>
              <button type="submit" className="btn-warn">
                File dispute
              </button>
            </form>
          </Card>
        )}

      {(request.status === "DISPUTED" || request.status === "UNDISPUTED") &&
        role === "AGENT" && (
          <Card
            title="Decide this claim"
            sub="Maker-checker enforced: you may not decide if you filed or notified this claim."
          >
            <form action={decideAction.bind(null, request.id)} className="space-y-3 text-sm">
              <label className="field">
                <span>Rationale</span>
                <textarea name="rationale" required rows={3} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="decision" value="approve" className="btn-success">
                  Approve release
                </button>
                <button type="submit" name="decision" value="deny" className="btn-danger">
                  Deny
                </button>
              </div>
            </form>
          </Card>
        )}

      {request.status === "APPROVED" && role === "AGENT" && (
        <Card
          title="Record secure delivery"
          className="border-emerald-300 bg-emerald-50/60"
        >
          <form action={deliverAction.bind(null, request.id)} className="space-y-3 text-sm">
            <label className="field">
              <span>Handover reference</span>
              <input
                name="handoverRef"
                required
                maxLength={500}
                placeholder="e.g. encrypted vault transfer #4821, confirmed by beneficiary"
              />
            </label>
            <button type="submit" className="btn-success">
              Mark delivered
            </button>
          </form>
        </Card>
      )}

      {request.status === "DELIVERED" && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Delivered</strong>
          {request.deliveryNote ? `: ${request.deliveryNote}` : "."}
          {request.decidedBy ? ` Decided by ${request.decidedBy.email}.` : ""}
        </div>
      )}
      {request.status === "DENIED" && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          Claim denied{request.decidedBy ? ` by ${request.decidedBy.email}` : ""}.
        </div>
      )}
    </div>
  );
}
