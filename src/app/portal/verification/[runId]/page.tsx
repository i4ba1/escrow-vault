import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
import {
  Card,
  PageHeader,
  RunBadge,
  StatusBadge,
  TierBadge,
} from "@/components/ui";
import {
  decideAction,
  executeRunAction,
  getPortalRun,
} from "../actions";

// Run detail: findings ledger, certificate, and the agent controls valid for
// the current state (execute when QUEUED, sign-off when CERTIFIED+RUNNING).
export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const session = await requireAppSession();
  const run = await getPortalRun(runId).catch(() => null);
  if (!run) notFound();

  const isAgent = session.user.appRole === "AGENT";
  const findings = (run.findings as { checks?: { name: string; pass: boolean; detail: string }[] } | null)?.checks ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={`${run.tier} verification`}
        sub={`${run.deposit.agreement.vendorName} → ${run.deposit.agreement.beneficiaryName} · v${run.deposit.version}`}
        actions={
          <>
            <TierBadge tier={run.tier} />
            <RunBadge status={run.status} />
          </>
        }
      />

      <Card title={`Checks (${findings.length})`}>
        {findings.length === 0 ? (
          <p className="text-sm text-stone-500">Not executed yet.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map((c) => (
              <li
                key={c.name}
                className={`rounded-lg border p-3 text-sm ${
                  c.pass ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60"
                }`}
              >
                <span className={`font-semibold ${c.pass ? "text-emerald-700" : "text-rose-700"}`}>
                  {c.pass ? "PASS" : "FAIL"}
                </span>{" "}
                <span className="font-medium text-stone-900">{c.name}</span>
                <p className="mt-0.5 text-stone-500">{c.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {run.certificate && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-sm">
          <h2 className="font-semibold text-emerald-950">Resilience certificate</h2>
          <p className="mt-1 font-mono text-base font-bold text-emerald-900">
            {run.certificate.serialNo}
          </p>
          <p className="mt-1 text-emerald-800">
            Issued {run.certificate.issuedAt.toISOString().slice(0, 10)} ·{" "}
            <a
              className="font-medium underline underline-offset-4"
              href={`/verify/${run.certificate.serialNo}`}
            >
              public verification page
            </a>
          </p>
        </div>
      )}

      {isAgent && run.status === "QUEUED" && (
        <form
          action={async () => {
            "use server";
            await executeRunAction(run.id);
          }}
        >
          <button type="submit" className="btn-primary">
            Execute {run.tier} checks
          </button>
        </form>
      )}

      {isAgent && run.tier === "CERTIFIED" && run.status === "RUNNING" && (
        <Card
          title="Human build-test sign-off"
          sub="Automated pre-checks passed. Confirm you compiled and ran the application from this deposit, then sign off."
          className="border-amber-300 bg-amber-50"
        >
          <form action={decideAction.bind(null, run.id)} className="space-y-3 text-sm">
            <label className="field">
              <span>Review note</span>
              <input
                name="note"
                required
                maxLength={500}
                placeholder="e.g. built from source.tar.gz, smoke test green"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="decision" value="approve" className="btn-success">
                Approve &amp; issue certificate
              </button>
              <button type="submit" name="decision" value="reject" className="btn-danger">
                Reject
              </button>
            </div>
          </form>
        </Card>
      )}

      {!isAgent && (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <StatusBadge tone="zinc">read-only</StatusBadge>
          Execution and sign-off need the agent role.
        </p>
      )}
    </div>
  );
}
