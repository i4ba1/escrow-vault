import Link from "next/link";
import type { ReactNode } from "react";

// Shared primitives per docs/design.md §5. Pages compose these instead of
// ad-hoc Tailwind so the visual language stays consistent. Same export names
// as v1 so page migration is mechanical.

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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[15px] font-medium text-tx-hi">{title}</h1>
        {sub && <span className="text-[13px] text-tx-lo">{sub}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  sub,
  children,
  className = "",
  action,
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header
          className={`${title ? "mb-3 flex items-center justify-between gap-2" : ""}`}
        >
          <div>
            {title && <h2 className="panel-label">{title}</h2>}
            {sub && <p className="mt-0.5 text-[13px] text-tx-lo">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type Tone = "zinc" | "amber" | "sky" | "emerald" | "rose";

const TONES: Record<Tone, string> = {
  zinc: "border-line bg-tx-mid/10 text-tx-mid",
  amber: "border-warn/25 bg-warn/12 text-warn",
  sky: "border-info/25 bg-info/12 text-info",
  emerald: "border-ok/25 bg-ok/12 text-ok",
  rose: "border-bad/25 bg-bad/12 text-bad",
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
  SUPERSEDED: "zinc",
};

const RUN_TONES: Record<string, Tone> = {
  QUEUED: "zinc",
  RUNNING: "amber",
  PASSED: "emerald",
  FAILED: "rose",
  EXPIRED: "zinc",
};

const SCAN_TONES: Record<string, Tone> = {
  PENDING: "amber",
  PASS: "emerald",
  FAIL: "rose",
};

const RELEASE_TONES: Record<string, Tone> = {
  FILED: "sky",
  NOTIFIED: "amber",
  DISPUTED: "sky",
  UNDISPUTED: "zinc",
  APPROVED: "emerald",
  DENIED: "rose",
  DELIVERED: "emerald",
};

const ROLE_TONES: Record<string, Tone> = {
  DEPOSITOR: "zinc",
  AGENT: "sky",
  BENEFICIARY: "zinc",
  AUDITOR: "zinc",
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
  return (
    <StatusBadge tone={tier === "CERTIFIED" ? "sky" : "zinc"}>{tier}</StatusBadge>
  );
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
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <p className="text-[13px] text-tx-mid">{title}</p>
      {hint && <p className="text-[13px] text-tx-lo">{hint}</p>}
      {action && <div className="mt-2 flex">{action}</div>}
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

export function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="px-4 py-3 first:pl-0">
      <p className="panel-label">{label}</p>
      <p className="stat-value mt-1">{value}</p>
      <Link
        href={href}
        className="mt-0.5 inline-block text-[13px] text-tx-lo transition-colors hover:text-accent"
      >
        {label === "Open runs" ? "Queue →" : "View →"}
      </Link>
    </div>
  );
}

export function KeyValue({
  rows,
}: {
  rows: [string, ReactNode][];
}) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-[13px] text-tx-lo">{key}</dt>
          <dd className="min-w-0 truncate text-right text-[13px] text-tx-hi">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface TimelineEvent {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorEmail: string | null;
  at: Date;
}

// Audit timeline primitive (docs/design.md §5): day-grouped, one line per
// event. Consumed by the portal audit page.
export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="border-l border-line">
      {events.map((e, index) => {
        const day = e.at.toISOString().slice(0, 10);
        const prevDay = index > 0 ? events[index - 1].at.toISOString().slice(0, 10) : null;
        const showDay = day !== prevDay;
        return (
          <li key={e.id} className="relative ml-2 pl-4">
            {showDay && (
              <p className="pt-4 pb-2 text-xs text-tx-lo tabular-nums">{day}</p>
            )}
            <span
              className={`absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-tx-mid ${
                showDay ? "top-[46px]" : "top-[5px]"
              }`}
            />
            <p className="py-1 text-[13px]">
              <span className="font-medium text-tx-hi">{e.action}</span>{" "}
              <span className="text-tx-mid">{e.entity}</span>{" "}
              <span className="font-mono text-xs text-tx-lo">{e.entityId.slice(0, 8)}</span>
            </p>
            <p className="pb-2 text-xs text-tx-lo tabular-nums">
              {e.at.toISOString().replace("T", " ").slice(11, 19)}Z ·{" "}
              {e.actorEmail ?? "automated"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
