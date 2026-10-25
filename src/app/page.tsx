import Link from "next/link";

const STEPS: { label: string; text: string }[] = [
  {
    label: "Deposit",
    text: "Vendors deposit source, schemas, configs and build scripts into encrypted workspace storage, versioned by agreement.",
  },
  {
    label: "Verify",
    text: "Integrity scans and human build tests climb the Validated → Verified → Certified ladder. Each tier issues a resilience certificate.",
  },
  {
    label: "Release",
    text: "When a contractual trigger fires, the beneficiary claims, the vendor may dispute, and agents decide under maker-checker.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-app text-tx-hi">
      <header className="mx-auto max-w-7xl px-4 pt-5 sm:px-5">
        <nav className="flex items-center justify-between">
          <p className="text-[15px] font-medium tracking-tight text-tx-hi">
            Escrow<span className="text-accent">Vault</span>
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/verify/CERT-2026-0001"
              className="rounded-[6px] px-3 py-1.5 text-[13px] text-tx-mid transition-colors hover:text-tx-hi"
            >
              Verify a certificate
            </Link>
            <Link href="/portal" className="btn-ghost">
              Open the portal
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-5">
        <section className="max-w-2xl py-20">
          <p className="panel-label">Escrow, operated like software</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">
            Your critical software, recoverable{" "}
            <span className="text-accent">no matter what</span>.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-tx-mid">
            EscrowVault holds vendors&apos; deposit materials in escrow, proves
            they build and run through tiered verification, and releases them to
            beneficiaries when contractual triggers fire.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/portal" className="btn-primary">
              Open the portal
            </Link>
            <Link href="/verify/CERT-2026-0001" className="btn-ghost">
              See a live certificate
            </Link>
          </div>
        </section>

        <section className="grid gap-8 border-t border-line pb-16 pt-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.label}>
              <p className="panel-label">{s.label}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-tx-mid">{s.text}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-start justify-between gap-3 rounded-[6px] border border-line bg-panel p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[13px] text-tx-hi">
              Holding a certificate serial? Verify it in seconds.
            </p>
            <p className="mt-0.5 font-mono text-xs text-accent">CERT-2026-0001</p>
          </div>
          <Link href="/verify/CERT-2026-0001" className="btn-ghost">
            Verify — no login needed
          </Link>
        </section>

        <footer className="py-8 text-center text-xs text-tx-lo">
          EscrowVault demo · deposits are sample data · MIT licensed
        </footer>
      </main>
    </div>
  );
}
