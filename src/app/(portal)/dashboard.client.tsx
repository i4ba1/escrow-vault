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

const TIERS = ["VALIDATED", "VERIFIED", "CERTIFIED"];

function DashboardWidgets() {
  const { data, loading, error } = useQuery<DashboardData>(DASHBOARD_QUERY);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded border border-zinc-200 bg-zinc-50" />
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-sm text-red-700">
        Dashboard failed to load: {error?.message ?? "no data"}.
      </p>
    );
  }

  const statuses = [...new Set(data.deposits.map((d) => d.status))];
  const statusCounts = statuses.map(
    (s) => data.deposits.filter((d) => d.status === s).length,
  );
  const runs = data.deposits.flatMap((d) => d.verificationRuns);
  const passByTier = TIERS.map(
    (t) => runs.filter((r) => r.tier === t && r.status === "PASSED").length,
  );
  const failByTier = TIERS.map(
    (t) => runs.filter((r) => r.tier === t && r.status === "FAILED").length,
  );
  const certs = runs.filter((r) => r.certificate).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Agreements" value={String(data.agreements.length)} href="/portal/deposits" link="Deposits →" />
        <StatCard label="Deposits" value={String(data.deposits.length)} href="/portal/deposits" link="Deposits →" />
        <StatCard label="Certificates" value={String(certs)} href="/portal/verification" link="Verification →" />
        <StatCard label="Open runs" value={String(runs.filter((r) => r.status === "QUEUED" || r.status === "RUNNING").length)} href="/portal/verification" link="Queue →" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <figure className="rounded border border-zinc-200 p-4">
          <figcaption className="text-sm font-semibold">Deposits by status</figcaption>
          <div className="mx-auto max-w-64">
            <Doughnut
              data={{
                labels: statuses,
                datasets: [{ data: statusCounts, backgroundColor: ["#18181b", "#f59e0b", "#3b82f6", "#22c55e", "#a1a1aa"] }],
              }}
              options={{ plugins: { legend: { position: "bottom" } } }}
            />
          </div>
        </figure>
        <figure className="rounded border border-zinc-200 p-4">
          <figcaption className="text-sm font-semibold">Verification outcomes by tier</figcaption>
          <Bar
            data={{
              labels: TIERS,
              datasets: [
                { label: "Passed", data: passByTier, backgroundColor: "#15803d" },
                { label: "Failed", data: failByTier, backgroundColor: "#b91c1c" },
              ],
            }}
            options={{ plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
          />
        </figure>
      </div>
      <section className="rounded border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {data.auditEvents.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No events yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {data.auditEvents.map((e) => (
              <li key={e.id}>
                <span className="font-medium">{e.action}</span>{" "}
                <span className="text-zinc-500">
                  {e.entity} · {e.actorEmail ?? "automated"} · {e.at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <a href="/portal/audit" className="mt-2 inline-block text-sm underline underline-offset-4">
          Full timeline →
        </a>
      </section>
    </div>
  );
}

function StatCard({ label, value, href, link }: { label: string; value: string; href: string; link: string }) {
  return (
    <div className="rounded border border-zinc-200 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <a href={href} className="text-xs underline underline-offset-4">{link}</a>
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
