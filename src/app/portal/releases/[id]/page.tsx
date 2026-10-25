import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
import { Card, KeyValue, PageHeader, ReleaseBadge } from "@/components/ui";
import {
  decideAction,
  deliverAction,
  disputeAction,
  getPortalRelease,
  notifyAction,
} from "../actions";

const ROLE_LABELS: Record<string, string> = {
  DEPOSITOR: "Depositor (vendor)",
  AGENT: "Escrow agent",
  BENEFICIARY: "Beneficiary",
  AUDITOR: "Auditor",
};

// Claim lifecycle console (docs/design.md §6): KeyValue master block + plain
// evidence rows + the ONE action panel valid for the current role+state.
// The service re-enforces both server-side.
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
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={`${request.trigger}`}
        sub={`${request.agreement.vendorName} → ${request.agreement.beneficiaryName}`}
        actions={<ReleaseBadge status={request.status} />}
      />

      <Card title="Filing">
        <KeyValue
          rows={[
            ["Filed by", request.filedBy.email],
            [
              "Filed on",
              <span key="filed" className="font-mono">
                {request.createdAt.toISOString().slice(0, 10)}
              </span>,
            ],
            ["Your role", ROLE_LABELS[role] ?? role],
            ...(request.notifiedBy
              ? ([
                  ["Notified by", request.notifiedBy.email],
                  ...(request.disputeUntil
                    ? ([[
                        "Dispute until",
                        <span key="window" className="font-mono">
                          {request.disputeUntil.toISOString().slice(0, 10)}
                        </span>,
                      ]] as [string, React.ReactNode][])
                    : []),
                ] as [string, React.ReactNode][])
              : []),
            ...(request.decidedBy
              ? ([
                  ["Decided by", request.decidedBy.email],
                  [
                    "Decided on",
                    <span key="decided" className="font-mono">
                      {request.decidedAt?.toISOString().slice(0, 10)}
                    </span>,
                  ],
                ] as [string, React.ReactNode][])
              : []),
            ...(request.deliveryNote
              ? ([
                  ["Delivery", request.deliveryNote],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </Card>

      <Card title="Evidence">
        <p className="text-[13px] text-tx-hi">{evidence.summary ?? "(none)"}</p>
        {(evidence.tickets ?? []).length > 0 && (
          <p className="mt-1 font-mono text-xs text-tx-lo">
            {evidence.tickets!.join(" · ")}
          </p>
        )}
        {evidence.dispute && (
          <div className="mt-3 border-l-2 border-warn pl-3">
            <p className="text-[13px] text-tx-mid">{evidence.dispute.note}</p>
            <p className="mt-0.5 text-xs text-tx-lo">
              vendor counter-evidence · {evidence.dispute.at?.slice(0, 10)}
            </p>
          </div>
        )}
      </Card>

      {request.status === "NOTIFIED" && daysLeft != null && (
        <p className="text-[13px] text-warn">
          Dispute window: {daysLeft} day(s) remaining — decide or the window lapses.
        </p>
      )}

      {request.status === "FILED" && role === "AGENT" && (
        <Card
          title="Accept for processing"
          sub="Opens the contractual dispute window. You become the notifier and are barred from deciding this claim (maker-checker)."
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
            <form action={disputeAction.bind(null, request.id)} className="space-y-3">
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
            sub="Maker-checker: you may not decide a claim you filed or notified."
          >
            <form action={decideAction.bind(null, request.id)} className="space-y-3">
              <label className="field">
                <span>Rationale</span>
                <textarea name="rationale" required rows={3} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="decision" value="approve" className="btn-primary">
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
        <Card title="Record secure delivery">
          <form action={deliverAction.bind(null, request.id)} className="space-y-3">
            <label className="field">
              <span>Handover reference</span>
              <input
                name="handoverRef"
                required
                maxLength={500}
                placeholder="e.g. encrypted vault transfer #4821, confirmed by beneficiary"
              />
            </label>
            <button type="submit" className="btn-primary">
              Mark delivered
            </button>
          </form>
        </Card>
      )}

      {request.status === "DENIED" && (
        <p className="text-[13px] text-tx-mid">
          Claim denied{request.decidedBy ? ` by ${request.decidedBy.email}` : ""}.
        </p>
      )}
    </div>
  );
}
