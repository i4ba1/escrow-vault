import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
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
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header>
        <p className="text-sm text-zinc-500">
          {run.deposit.agreement.vendorName} → {run.deposit.agreement.beneficiaryName} · v{run.deposit.version}
        </p>
        <h1 className="text-2xl font-bold">
          {run.tier} · {run.status}
        </h1>
      </header>

      <section>
        <h2 className="font-semibold">Checks ({findings.length})</h2>
        {findings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Not executed yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {findings.map((c) => (
              <li key={c.name} className="rounded border border-zinc-200 p-3">
                <span className={c.pass ? "text-green-700" : "text-red-700"}>
                  {c.pass ? "PASS" : "FAIL"}
                </span>{" "}
                <span className="font-medium">{c.name}</span>
                <p className="text-zinc-500">{c.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {run.certificate && (
        <section className="rounded border border-green-300 bg-green-50 p-4 text-sm">
          <h2 className="font-semibold text-green-900">Resilience certificate</h2>
          <p className="mt-1 font-mono">{run.certificate.serialNo}</p>
          <p className="text-zinc-600">
            Issued {run.certificate.issuedAt.toISOString().slice(0, 10)} ·{" "}
            <a className="underline" href={`/verify/${run.certificate.serialNo}`}>
              public verification page
            </a>
          </p>
        </section>
      )}

      {isAgent && run.status === "QUEUED" && (
        <form
          action={async () => {
            "use server";
            await executeRunAction(run.id);
          }}
        >
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Execute {run.tier} checks
          </button>
        </form>
      )}

      {isAgent &&
        run.tier === "CERTIFIED" &&
        run.status === "RUNNING" && (
          <section className="rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="font-semibold">Human build-test sign-off</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Automated pre-checks passed. Confirm you compiled and ran the
              application from this deposit, then sign off.
            </p>
            <form action={decideAction.bind(null, run.id)} className="mt-3 space-y-3 text-sm">
              <label className="block">
                <span className="font-medium">Review note</span>
                <input
                  name="note"
                  required
                  maxLength={500}
                  placeholder="e.g. built from source.tar.gz, smoke test green"
                  className="mt-1 block w-full rounded border border-zinc-300 p-2"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className="rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-600"
                >
                  Approve &amp; issue certificate
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="reject"
                  className="rounded bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            </form>
          </section>
        )}
    </main>
  );
}
