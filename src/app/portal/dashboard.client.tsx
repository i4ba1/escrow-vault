"use client";

import { ApolloProvider, useQuery } from "@apollo/client/react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { parse } from "graphql";
import { Bar } from "react-chartjs-2";
import { getApolloClient } from "@/lib/apollo-client";
import {
  buildTierOutcomes,
  countCertificates,
  countOpenRuns,
} from "@/lib/dashboard-stats";
import { StatTile } from "@/components/ui";

ChartJS.register(
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

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-20 animate-pulse rounded-[6px] border border-line bg-panel" />
      <div className="h-56 animate-pulse rounded-[6px] border border-line bg-panel" />
    </div>
  );
}

// Restyled per docs/design.md §6-7: StatTile panel + ONE bar chart +
// activity list. No doughnut, no colored stat cards, no decorative icons.
function DashboardWidgets() {
  const { data, loading, error } = useQuery<DashboardData>(DASHBOARD_QUERY);

  if (loading) return <Skeleton />;
  if (error || !data) {
    return (
      <div className="rounded-[6px] border border-bad/30 bg-bad/10 p-4 text-[13px] text-bad">
        Dashboard failed to load: {error?.message ?? "no data"}.
      </div>
    );
  }

  const runs = data.deposits.flatMap((d) => d.verificationRuns);
  const { tiers, passed, failed } = buildTierOutcomes(runs);

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
        <StatTile label="Agreements" value={String(data.agreements.length)} href="/portal/deposits" />
        <StatTile label="Deposits" value={String(data.deposits.length)} href="/portal/deposits" />
        <StatTile label="Certificates" value={String(countCertificates(runs))} href="/portal/verification" />
        <StatTile label="Open runs" value={String(countOpenRuns(runs))} href="/portal/verification" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card">
          <h2 className="panel-label mb-3">Verification outcomes by tier</h2>
          <div className="relative h-40">
            <Bar
              data={{
                labels: tiers,
                datasets: [
                  { label: "Passed", data: passed, backgroundColor: "#0fbf9a" },
                  { label: "Failed", data: failed, backgroundColor: "#5c6370" },
                ],
              }}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#a8acb3",
                      font: { family: "Geist Mono, monospace", size: 11 },
                      boxWidth: 10,
                      boxHeight: 10,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: {
                      color: "#8a8f98",
                      font: { family: "Geist Mono, monospace", size: 10 },
                    },
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(255,255,255,0.06)" },
                    border: { display: false },
                    ticks: {
                      stepSize: 1,
                      color: "#8a8f98",
                      font: { family: "Geist Mono, monospace", size: 10 },
                    },
                  },
                },
              }}
            />
          </div>
        </section>

        <section className="card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="panel-label">Recent activity</h2>
            <a
              href="/portal/audit"
              className="text-[13px] text-tx-lo transition-colors hover:text-accent"
            >
              Full timeline →
            </a>
          </div>
          {data.auditEvents.length === 0 ? (
            <p className="text-[13px] text-tx-lo">No events yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.auditEvents.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2 py-1.5 text-[13px]">
                  <span className="font-medium text-tx-hi">{e.action}</span>
                  <span className="text-tx-mid">{e.entity}</span>
                  <span className="ml-auto text-xs text-tx-lo tabular-nums">
                    {e.actorEmail ?? "automated"} · {e.at.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
