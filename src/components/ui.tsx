import Link from "next/link";
import type { ReactNode } from "react";

// Shared primitives: every portal page composes these instead of ad-hoc
// Tailwind, so the visual language stays consistent as the app grows.

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-950">{title}</h1>
        {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  sub,
  children,
  className = "",
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || sub) && (
        <header className="mb-3">
          {title && <h2 className="card-title">{title}</h2>}
          {sub && <p className="card-sub">{sub}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

type Tone =
  | "zinc"
  | "amber"
  | "sky"
  | "emerald"
  | "rose"
  | "violet"
  | "stone"
  | "teal"
  | "orange";

const TONES: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-700",
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-800",
  emerald: "bg-emerald-100 text-emerald-800",
  rose: "bg-rose-100 text-rose-800",
  violet: "bg-violet-100 text-violet-800",
  stone: "bg-stone-200 text-stone-600",
  teal: "bg-teal-100 text-teal-800",
  orange: "bg-orange-100 text-orange-800",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

function toneFor(map: Record<string, Tone>, status: string, fallback: Tone = "zinc"): Tone {
  return map[status] ?? fallback;
}

const DEPOSIT_TONES: Record<string, Tone> = {
  DRAFT: "zinc",
  UPLOADING: "amber",
  SCANNING: "sky",
  READY: "sky",
  ACTIVE: "emerald",
  SUPERSEDED: "stone",
};

const RUN_TONES: Record<string, Tone> = {
  QUEUED: "zinc",
  RUNNING: "amber",
  PASSED: "emerald",
  FAILED: "rose",
  EXPIRED: "stone",
};

const SCAN_TONES: Record<string, Tone> = {
  PENDING: "amber",
  PASS: "emerald",
  FAIL: "rose",
};

const RELEASE_TONES: Record<string, Tone> = {
  FILED: "sky",
  NOTIFIED: "amber",
  DISPUTED: "orange",
  UNDISPUTED: "stone",
  APPROVED: "emerald",
  DENIED: "rose",
  DELIVERED: "teal",
};

const ROLE_TONES: Record<string, Tone> = {
  DEPOSITOR: "sky",
  AGENT: "violet",
  BENEFICIARY: "amber",
  AUDITOR: "stone",
};

export function DepositBadge({ status }: { status: string }) {
  return <StatusBadge tone={toneFor(DEPOSIT_TONES, status)}>{status}</StatusBadge>;
}

export function RunBadge({ status }: { status: string }) {
  return <StatusBadge tone={toneFor(RUN_TONES, status)}>{status}</StatusBadge>;
}

export function ScanBadge({ status }: { status: string }) {
  return <StatusBadge tone={toneFor(SCAN_TONES, status)}>{status}</StatusBadge>;
}

export function ReleaseBadge({ status }: { status: string }) {
  return <StatusBadge tone={toneFor(RELEASE_TONES, status)}>{status}</StatusBadge>;
}

export function RoleBadge({ role }: { role: string }) {
  return <StatusBadge tone={toneFor(ROLE_TONES, role)}>{role}</StatusBadge>;
}

export function TierBadge({ tier }: { tier: string }) {
  const tone: Tone =
    tier === "CERTIFIED" ? "violet" : tier === "VERIFIED" ? "sky" : "zinc";
  return <StatusBadge tone={tone}>{tier}</StatusBadge>;
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
      <p className="font-medium text-stone-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn-primary">
      {children}
    </Link>
  );
}
