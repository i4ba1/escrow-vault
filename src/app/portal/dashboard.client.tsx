"use client";

import { ApolloProvider, useQuery } from "@apollo/client/react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { parse } from "graphql";
import { Bar, Doughnut } from "react-chartjs-2";
import { getApolloClient } from "@/lib/apollo-client";
import {
  buildStatusDistribution,
  buildTierOutcomes,
  countCertificates,
  countOpenRuns,
} from "@/lib/dashboard-stats";
import { Card } from "@/components/ui";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

const DASHBOARD_QUERY = parse(/* GraphQL */ `
  query DashboardData {
    agreements {
      id
    }
    deposits {
      id
      status
      verificationRuns {
        tier
        status
        certificate {
          serialNo
        }
      }
    }
    auditEvents(limit: 8) {
      id
      entity
      action
      actorEmail
      at
    }
  }
`);

interface DashboardData {
  agreements: { id: string }[];
  deposits: {
    id: string;
    status: string;
    verificationRuns: {
      tier: string;
      status: string;
      certificate: { serialNo: string } | null;
    }[];
  }[];
  auditEvents: {
    id: string;
    entity: string;
    action: string;
    actorEmail: string | null;
    at: string;
  }[];
}

function DashboardWidgets() {
  const { data, loading, error } = useQuery<DashboardData>(DASHBOARD_QUERY);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl border border-stone-200 bg-white" />
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Dashboard failed to load: {error?.message ?? "no data"}.
      </div>
    );
  }

  const { labels: statuses, counts: statusCounts } = buildStatusDistribution(
    data.deposits.map((d) => d.status),
  );
  const runs = data.deposits.flatMap((d) => d.verificationRuns);
  const {
    tiers,
    passed: passByTier,
    failed: failByTier,
  } = buildTierOutcomes(runs);
  const certs = countCertificates(runs);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agreements" value={String(data.agreements.length)} href="/portal/deposits" link="View deposits" />
        <StatCard label="Deposits" value={String(data.deposits.length)} href="/portal/deposits" link="View deposits" />
        <StatCard label="Certificates" value={String(certs)} href="/portal/verification" link="Verification" />
        <StatCard label="Open runs" value={String(countOpenRuns(runs))} href="/portal/verification" link="Open queue" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Deposits by status">
          <div className="mx-auto max-w-72">
            <Doughnut
              data={{
                labels: statuses,
                datasets: [
                  {
                    data: statusCounts,
                    backgroundColor: ["#047857", "#f59e0b", "#0284c7", "#1c1917", "#a8a29e"],
                    borderWidth: 2,
                    borderColor: "#ffffff",
                  },
                ],
              }}
              options={{ plugins: { legend: { position: "bottom" } } }}
            />
          </div>
        </Card>
        <Card title="Verification outcomes by tier">
          <Bar
            data={{
              labels: tiers,
              datasets: [
                { label: "Passed", data: passByTier, backgroundColor: "#059669", borderRadius: 6 },
                { label: "Failed", data: failByTier, backgroundColor: "#e11d48", borderRadius: 6 },
              ],
            }}
            options={{
              plugins: { legend: { position: "bottom" } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            }}
          />
        </Card>
      </div>
      <Card
        title="Recent activity"
        sub="Latest audit events across the tenant"
        className="overflow-hidden"
      >
        {data.auditEvents.length === 0 ? (
          <p className="text-sm text-stone-500">No events yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {data.auditEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <span className="font-semibold text-stone-900">{e.action}</span>
                <span className="text-stone-500">
                  {e.entity} · {e.actorEmail ?? "automated"} · {e.at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <a
          href="/portal/audit"
          className="mt-3 inline-block text-sm font-medium text-emerald-700 underline-offset-4 hover:underline"
        >
          Full timeline →
        </a>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  link,
}: {
  label: string;
  value: string;
  href: string;
  link: string;
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-stone-950 tabular-nums">{value}</p>
      <a
        href={href}
        className="mt-1 inline-block text-xs font-medium text-emerald-700 underline-offset-4 hover:underline"
      >
        {link} →
      </a>
    </div>
  );
}

export function Dashboard() {
  return (
    <ApolloProvider client={getApolloClient()}>
      <DashboardWidgets />
    </ApolloProvider>
  );
}
