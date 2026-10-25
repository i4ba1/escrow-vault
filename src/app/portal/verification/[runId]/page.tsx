import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
import { Card, KeyValue, PageHeader, RunBadge, TierBadge } from "@/components/ui";
import {
  decideAction,
  executeRunAction,
  getPortalRun,
} from "../actions";

// Run detail (docs/design.md §6): checks as rows — pill + label + one-line
// detail — not boxes. Certificate strip only when issued.
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
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={`${run.tier} run`}
        sub={`${run.deposit.agreement.vendorName} v${run.deposit.version}`}
        actions={
          <>
            <TierBadge tier={run.tier} />
            <RunBadge status={run.status} />
          </>
        }
      />

      <Card title={`Checks · ${findings.length}`}>
        {findings.length === 0 ? (
          <p className="text-[13px] text-tx-lo">Not executed yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {findings.map((c) => (
              <li key={c.name} className="flex flex-wrap items-baseline gap-x-2 py-2 text-[13px]">
                <span className={`font-mono text-xs font-medium ${c.pass ? "text-ok" : "text-bad"}`}>
                  {c.pass ? "PASS" : "FAIL"}
                </span>
                <span className="font-mono text-xs text-tx-hi">{c.name}</span>
                <span className="w-full text-tx-lo">{c.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {run.certificate && (
        <Card title="Certificate">
          <KeyValue
            rows={[
              [
                "Serial",
                <a
                  key="serial"
                  href={`/verify/${run.certificate.serialNo}`}
                  className="font-mono text-accent transition-colors hover:opacity-80"
                >
                  {run.certificate.serialNo} →
                </a>,
              ],
              [
                "Issued",
                <span key="issued" className="font-mono">
                  {run.certificate.issuedAt.toISOString().slice(0, 10)}
                </span>,
              ],
            ]}
          />
        </Card>
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
          sub="Confirm you compiled and ran the application from this deposit."
        >
          <form action={decideAction.bind(null, run.id)} className="space-y-3">
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
              <button type="submit" name="decision" value="approve" className="btn-primary">
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
        <p className="text-[13px] text-tx-lo">
          Read-only — execution and sign-off need the agent role.
        </p>
      )}
    </div>
  );
}
