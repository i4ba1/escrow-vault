import { getPortalAuditEvents } from "./actions";

// Immutable audit timeline: every deposit transition, scan verdict,
// verification step and release event, newest first. Append-only by design.
export default async function AuditPage() {
  const events = await getPortalAuditEvents();
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Audit timeline</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {events.length} event(s) · newest first · append-only
      </p>
      {events.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No events recorded yet.</p>
      ) : (
        <ol className="mt-6 space-y-0 border-l-2 border-zinc-200">
          {events.map((e) => (
            <li key={e.id} className="relative pb-6 pl-6 last:pb-0">
              <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-zinc-400" />
              <p className="text-sm">
                <span className="font-semibold">{e.action}</span>{" "}
                <span className="text-zinc-500">
                  {e.entity} · {e.entityId.slice(0, 8)}
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {e.at.toISOString().replace("T", " ").slice(0, 19)}Z
                {e.actorEmail ? ` · by ${e.actorEmail}` : " · automated"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
