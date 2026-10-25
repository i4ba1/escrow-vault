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

// Deposit detail (docs/design.md §6): assets table with upload in the panel
// footer, verification ladder as compact rows, actions as primary CTA.
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
    <div className="space-y-4">
      <PageHeader
        title={`Deposit v${deposit.version}`}
        sub={`${deposit.agreement.vendorName} → ${deposit.agreement.beneficiaryName}`}
        actions={<DepositBadge status={deposit.status} />}
      />

      <Card
        title="Assets"
        sub="Hash-verified by the scan worker before they count."
        action={
          deposit.assets.length > 0 && (
            <span className="font-mono text-xs text-tx-lo">
              {deposit.assets.length} file{deposit.assets.length === 1 ? "" : "s"}
            </span>
          )
        }
      >
        {deposit.assets.length === 0 ? (
          <p className="text-[13px] text-tx-lo">No files uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ev-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>SHA-256</th>
                  <th className="text-right">Scan</th>
                </tr>
              </thead>
              <tbody>
                {deposit.assets.map((a) => (
                  <tr key={a.id}>
                    <td className="text-tx-hi">{a.filename}</td>
                    <td className="text-tx-mid">{a.type}</td>
                    <td className="font-mono text-tx-mid tabular-nums">
                      {a.sizeBytes.toString()} B
                    </td>
                    <td className="font-mono text-xs text-tx-lo">
                      {a.sha256.slice(0, 16)}…
                    </td>
                    <td className="text-right">
                      <ScanBadge status={a.scanStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(deposit.status === "DRAFT" || deposit.status === "UPLOADING") && (
          <div className="mt-4 border-t border-line pt-4">
            <UploadForm depositId={deposit.id} />
          </div>
        )}
      </Card>

      <Card title="Verification">
        {deposit.verificationRuns.length === 0 ? (
          <p className="text-[13px] text-tx-lo">
            Runs appear once every asset passes the integrity scan.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {deposit.verificationRuns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                <TierBadge tier={r.tier} />
                <span className="text-tx-mid">{r.status}</span>
                {r.certificate ? (
                  <Link
                    href={`/verify/${r.certificate.serialNo}`}
                    className="ml-auto font-mono text-xs text-tx-lo transition-colors hover:text-accent"
                  >
                    {r.certificate.serialNo} →
                  </Link>
                ) : (
                  <Link
                    href={`/portal/verification/${r.id}`}
                    className="ml-auto text-xs text-tx-lo transition-colors hover:text-accent"
                  >
                    open run →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAgent && upcomingTier && (
        <form action={escalateAction.bind(null, deposit.id, upcomingTier)}>
          <button type="submit" className="btn-primary">
            Escalate to {upcomingTier}
          </button>
        </form>
      )}

      {canActivate && (
        <form
          action={async () => {
            "use server";
            await activateDepositAction(deposit.id);
          }}
        >
          <button type="submit" className="btn-primary">
            Activate deposit
          </button>
        </form>
      )}

      {!canActivate && deposit.status !== "ACTIVE" && !isAgent && (
        <p className="text-[13px] text-tx-lo">
          Activation unlocks once every asset shows SCAN PASS.
        </p>
      )}
    </div>
  );
}
