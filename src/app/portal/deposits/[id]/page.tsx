import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppSession } from "@/lib/rbac";
import { nextTier } from "@/services/verification";
import {
  Card,
  DepositBadge,
  PageHeader,
  ScanBadge,
  TierBadge,
} from "@/components/ui";
import { escalateAction } from "../../verification/actions";
import { activateDepositAction, getPortalDeposit } from "../actions";
import { UploadForm } from "./upload-form.client";

// Deposit wizard, step 2: upload assets (presigned PUT straight to storage),
// watch the integrity scan flip them to PASS, then activate.
export default async function DepositDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAppSession();
  const deposit = await getPortalDeposit(id).catch(() => null);
  if (!deposit) notFound();

  const canActivate =
    (deposit.status === "DRAFT" || deposit.status === "UPLOADING") &&
    deposit.assets.length > 0 &&
    deposit.assets.every((a) => a.scanStatus === "PASS");

  const isAgent = session.user.appRole === "AGENT";
  const upcomingTier =
    deposit.status === "ACTIVE"
      ? nextTier(
          deposit.verificationRuns
            .filter((r) => r.status === "PASSED")
            .map((r) => r.tier),
        )
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Deposit v${deposit.version}`}
        sub={`${deposit.agreement.vendorName} → ${deposit.agreement.beneficiaryName}`}
        actions={<DepositBadge status={deposit.status} />}
      />

      <Card
        title={`Assets (${deposit.assets.length})`}
        sub="Files are hash-verified by the scan worker before they count."
      >
        {deposit.assets.length === 0 ? (
          <p className="text-sm text-stone-500">No files uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ev-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>SHA-256</th>
                  <th>Scan</th>
                </tr>
              </thead>
              <tbody>
                {deposit.assets.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.filename}</td>
                    <td className="text-stone-500">{a.type}</td>
                    <td className="tabular-nums">{a.sizeBytes.toString()} B</td>
                    <td className="font-mono text-xs text-stone-500">
                      {a.sha256.slice(0, 16)}…
                    </td>
                    <td>
                      <ScanBadge status={a.scanStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(deposit.status === "DRAFT" || deposit.status === "UPLOADING") && (
        <Card title="Upload a file" sub="Hashed in your browser, sent straight to encrypted storage.">
          <UploadForm depositId={deposit.id} />
        </Card>
      )}

      <Card title="Verification runs" sub="Tier history for this deposit.">
        {deposit.verificationRuns.length === 0 ? (
          <p className="text-sm text-stone-500">
            Runs appear once every asset passes the integrity scan.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {deposit.verificationRuns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <TierBadge tier={r.tier} />
                <span className="font-medium">{r.status}</span>
                {r.certificate && (
                  <Link
                    href={`/verify/${r.certificate.serialNo}`}
                    className="font-mono text-xs text-emerald-800 underline-offset-4 hover:underline"
                  >
                    {r.certificate.serialNo}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAgent && upcomingTier && (
        <Card
          title={`Request ${upcomingTier} verification`}
          sub="Opens the next tier run. Lower tiers must have passed — enforced server-side."
        >
          <form action={escalateAction.bind(null, deposit.id, upcomingTier)}>
            <button type="submit" className="btn-primary">
              Escalate to {upcomingTier}
            </button>
          </form>
        </Card>
      )}

      {canActivate ? (
        <form
          action={async () => {
            "use server";
            await activateDepositAction(deposit.id);
          }}
        >
          <button type="submit" className="btn-success">
            Activate deposit
          </button>
        </form>
      ) : (
        deposit.status !== "ACTIVE" && (
          <p className="text-sm text-stone-500">
            Activation unlocks once every asset shows SCAN PASS.
          </p>
        )
      )}
    </div>
  );
}
