import { notFound } from "next/navigation";
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
  return (
    <main className="mx-auto max-w-xl p-8">
      <p className="text-sm text-zinc-500">Software Resilience Certificate</p>
      <h1 className="mt-1 font-mono text-2xl font-bold">{certificate.serialNo}</h1>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between border-b pb-2">
          <dt className="text-zinc-500">Tier</dt>
          <dd className="font-medium">{certificate.tier}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-zinc-500">Outcome</dt>
          <dd className="font-medium">{run.status}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-zinc-500">Vendor</dt>
          <dd className="font-medium">{run.deposit.agreement.vendorName}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-zinc-500">Beneficiary</dt>
          <dd className="font-medium">{run.deposit.agreement.beneficiaryName}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-zinc-500">Deposit version</dt>
          <dd className="font-medium">v{run.deposit.version}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-zinc-500">Assets covered</dt>
          <dd className="font-medium">{run.deposit.assets.length}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Issued</dt>
          <dd className="font-medium">
            {certificate.issuedAt.toISOString().slice(0, 10)}
          </dd>
        </div>
      </dl>
    </main>
  );
}
