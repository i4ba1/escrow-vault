import { Card, EmptyState, PageHeader, Timeline } from "@/components/ui";
import { getPortalAuditEvents } from "./actions";

// Audit timeline (docs/design.md §6): day-grouped via the shared Timeline
// primitive, newest first, append-only.
export default async function AuditPage() {
  const events = await getPortalAuditEvents();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Audit"
        sub={`${events.length} event${events.length === 1 ? "" : "s"} · newest first`}
      />
      {events.length === 0 ? (
        <Card>
          <EmptyState title="No events recorded yet" />
        </Card>
      ) : (
        <Card className="max-h-[720px] overflow-y-auto">
          <Timeline events={events} />
        </Card>
      )}
    </div>
  );
}
