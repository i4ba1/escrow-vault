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
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-center text-xs font-semibold tracking-widest text-emerald-400 uppercase">
          Software Resilience Certificate
        </p>
        <h1 className="mt-2 text-center font-mono text-3xl font-bold tracking-tight text-white">
          {certificate.serialNo}
        </h1>
        <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {rows.map(([label, value], i) => (
            <div
              key={label}
              className={`flex items-center justify-between px-5 py-3 text-sm ${
                i === rows.length - 1 ? "" : "border-b border-white/10"
              }`}
            >
              <dt className="text-stone-400">{label}</dt>
              <dd className="font-medium text-white">{value}</dd>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">
          Verify this serial any time at{" "}
          <span className="font-mono">/verify/{certificate.serialNo}</span> ·{" "}
          <Link href="/" className="underline underline-offset-4 hover:text-stone-300">
            EscrowVault
          </Link>
        </p>
      </main>
    </div>
  );
}
