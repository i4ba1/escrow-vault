import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Deposit",
    text: "Vendors deposit source code, schemas, configs, and build scripts into encrypted, versioned storage — kept current with every release.",
  },
  {
    n: "02",
    title: "Verify",
    text: "Automated checks plus human build tests climb the Validated → Verified → Certified ladder, each issuing a resilience certificate.",
  },
  {
    n: "03",
    title: "Release",
    text: "When a contractual trigger fires, beneficiaries claim, vendors can dispute, and agents decide under maker-checker — every step audited.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Hero */}
      <header className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <nav className="flex items-center justify-between">
          <p className="text-lg font-bold tracking-tight text-white">
            Escrow<span className="text-emerald-400">Vault</span>
          </p>
          <div className="flex gap-2 text-sm">
            <Link
              href="/verify/CERT-2026-0001"
              className="rounded-lg px-4 py-2 font-medium text-stone-300 transition-colors hover:text-white"
            >
              Verify a certificate
            </Link>
            <Link
              href="/portal"
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              Open the portal
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <p className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-300 uppercase">
            Software escrow, minus the filing cabinet
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Your critical software, recoverable{" "}
            <span className="text-emerald-400">no matter what</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-stone-400">
            EscrowVault holds vendors&apos; source code and build materials in
            escrow, proves they actually work through tiered verification, and
            releases them to beneficiaries when contractual triggers fire.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/portal"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              Open the portal
            </Link>
            <Link
              href="/verify/CERT-2026-0001"
              className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-stone-200 transition-colors hover:bg-white/10"
            >
              See a live certificate
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <p className="font-mono text-xs font-bold text-emerald-400">{s.n}</p>
              <h2 className="mt-2 font-semibold text-white">{s.title}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-400">{s.text}</p>
            </div>
          ))}
        </section>

        {/* Trust strip */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-white">
              Hold a certificate serial? Check it instantly.
            </h2>
            <p className="mt-1 font-mono text-sm text-emerald-300">
              CERT-2026-0001
            </p>
          </div>
          <Link
            href="/verify/CERT-2026-0001"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-stone-950 transition-colors hover:bg-stone-200"
          >
            Verify now — no login needed
          </Link>
        </section>

        <footer className="py-10 text-center text-xs text-stone-500">
          EscrowVault demo · deposits are sample data · MIT licensed
        </footer>
      </main>
    </div>
  );
}
