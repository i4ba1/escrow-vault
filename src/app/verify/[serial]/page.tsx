import { notFound } from "next/navigation";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { prisma } from "@/lib/prisma";

// Public resilience-certificate lookup (no sign-in): anyone with the serial
// can confirm what was verified and when. Only certificate-safe fields are
// exposed — never user identities or storage keys.
//
// Caching: known serials prerender at build via generateStaticParams;
// unknown serials render on demand (dynamicParams). Certificates are
// immutable once issued, so no time-based revalidation is needed — and
// `revalidate` doesn't exist under Next 16 Cache Components anyway.
export async function generateStaticParams() {
  const certs = await prisma.certificate.findMany({
    select: { serialNo: true },
    take: 20,
  });
  return certs.map((c) => ({ serial: c.serialNo }));
}

// Certificates are immutable once issued, so the lookup is cached (hourly
// revalidation) instead of hitting Postgres on every visit — the Cache
// Components answer to ISR for public data.
async function getCertificate(serial: string) {
  "use cache";
  cacheLife("hours");
  return prisma.certificate.findUnique({
    where: { serialNo: serial },
    include: {
      verificationRun: {
        include: {
          deposit: { include: { agreement: true, assets: true } },
        },
      },
    },
  });
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const certificate = await getCertificate(serial);
  if (!certificate) notFound();

  const { verificationRun: run } = certificate;
  const rows: [string, string][] = [
    ["Tier", certificate.tier],
    ["Outcome", run.status],
    ["Vendor", run.deposit.agreement.vendorName],
    ["Beneficiary", run.deposit.agreement.beneficiaryName],
    ["Deposit version", `v${run.deposit.version}`],
    ["Assets covered", String(run.deposit.assets.length)],
    ["Issued", certificate.issuedAt.toISOString().slice(0, 10)],
  ];
  return (
    <div className="min-h-screen bg-app text-tx-hi">
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-center text-xs uppercase tracking-wider text-accent">
          Software Resilience Certificate
        </p>
        <h1 className="mt-2 text-center font-mono text-xl font-medium tracking-tight tabular-nums">
          {certificate.serialNo}
        </h1>
        <div className="card mt-8 px-5">
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between py-2.5">
                <dt className="text-[13px] text-tx-lo">{label}</dt>
                <dd className="text-[13px] font-medium text-tx-hi">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-6 text-center text-xs text-tx-lo">
          Verify this serial any time at{" "}
          <span className="font-mono">/verify/{certificate.serialNo}</span> ·{" "}
          <Link href="/" className="transition-colors hover:text-accent">
            EscrowVault
          </Link>
        </p>
      </main>
    </div>
  );
}
