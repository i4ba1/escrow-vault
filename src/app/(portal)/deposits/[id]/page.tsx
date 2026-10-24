import { notFound } from "next/navigation";
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
  const deposit = await getPortalDeposit(id).catch(() => null);
  if (!deposit) notFound();

  const canActivate =
    (deposit.status === "DRAFT" || deposit.status === "UPLOADING") &&
    deposit.assets.length > 0 &&
    deposit.assets.every((a) => a.scanStatus === "PASS");

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header>
        <p className="text-sm text-zinc-500">
          {deposit.agreement.vendorName} → {deposit.agreement.beneficiaryName}
        </p>
        <h1 className="text-2xl font-bold">
          Deposit v{deposit.version} · {deposit.status}
        </h1>
      </header>

      <section>
        <h2 className="font-semibold">Assets ({deposit.assets.length})</h2>
        {deposit.assets.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No files uploaded yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b text-zinc-500">
                <th className="py-2 pr-4 font-medium">File</th>
                <th className="py-2 pr-4 font-medium">Size</th>
                <th className="py-2 pr-4 font-medium">SHA-256</th>
                <th className="py-2 font-medium">Scan</th>
              </tr>
            </thead>
            <tbody>
              {deposit.assets.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.filename}</td>
                  <td className="py-2 pr-4">{a.sizeBytes.toString()} B</td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                    {a.sha256.slice(0, 16)}…
                  </td>
                  <td className="py-2">{a.scanStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(deposit.status === "DRAFT" || deposit.status === "UPLOADING") && (
        <section className="rounded border border-zinc-200 p-4">
          <h2 className="font-semibold">Upload a file</h2>
          <UploadForm depositId={deposit.id} />
        </section>
      )}

      <section>
        <h2 className="font-semibold">Verification runs</h2>
        {deposit.verificationRuns.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Runs appear once every asset passes the integrity scan.
          </p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {deposit.verificationRuns.map((r) => (
              <li key={r.id}>
                {r.tier} · {r.status}
                {r.certificate ? ` · ${r.certificate.serialNo}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canActivate ? (
        <form
          action={async () => {
            "use server";
            await activateDepositAction(deposit.id);
          }}
        >
          <button
            type="submit"
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
          >
            Activate deposit
          </button>
        </form>
      ) : (
        deposit.status !== "ACTIVE" && (
          <p className="text-sm text-zinc-500">
            Activation unlocks once every asset shows SCAN PASS.
          </p>
        )
      )}
    </main>
  );
}
