import { Card, PageHeader } from "@/components/ui";
import { getPortalAuditEvents } from "./actions";

// Immutable audit timeline: every deposit transition, scan verdict,
// verification step and release event, newest first. Append-only by design.
export default async function AuditPage() {
  const events = await getPortalAuditEvents();
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Audit timeline"
        sub={`${events.length} event${events.length === 1 ? "" : "s"} · newest first · append-only`}
      />
      {events.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-500">No events recorded yet.</p>
        </Card>
      ) : (
        <Card>
          <ol className="border-l-2 border-stone-200">
            {events.map((e) => (
              <li key={e.id} className="relative pb-5 pl-6 last:pb-0">
                <span className="absolute top-1 -left-[7px] h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow-sm" />
                <p className="text-sm">
                  <span className="font-semibold text-stone-900">{e.action}</span>{" "}
                  <span className="text-stone-500">
                    {e.entity} · <span className="font-mono text-xs">{e.entityId.slice(0, 8)}</span>
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
                  {e.at.toISOString().replace("T", " ").slice(0, 19)}Z
                  {e.actorEmail ? ` · by ${e.actorEmail}` : " · automated"}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
