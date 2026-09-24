import Link from "next/link";
import type { ActivityLogEntry } from "@/lib/activity-log";

/** e.g. "3m ago", "2h ago", "5d ago" — good enough for a staff activity feed, no need for a date library. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * requireWriteAccess returns either a staff email or `partner:{slug}` —
 * this reads that back into "Partner" / "Staff". A raw personal @deeptech
 * email here (e.g. a staff member testing a partner-facing action, or
 * covering for a partner) reads as if that person's own inbox were
 * involved, which is misleading when the entry is really about a shared
 * address like the Partnerships inbox — so it's never shown directly.
 */
function actorLabel(actor: string): string {
  if (actor.startsWith("partner:")) return "Partner";
  if (actor.endsWith("@deeptech.build")) return "Staff";
  return actor;
}

/**
 * Every partner-initiated (or staff-on-their-behalf) change across all
 * portals, newest first — the direct answer to "when a partner changes
 * something, we see it somehow" without needing outbound email (the Gmail
 * credentials configured for this app are read-only).
 */
export default function ActivityFeed({
  entries,
  companyNames,
}: {
  entries: ActivityLogEntry[];
  companyNames: Record<string, string>;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-4">
        <p className="eyebrow mb-1">Recent partner activity</p>
        <p className="text-sm text-fg-4">Nothing yet — this fills in as partners make changes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-4">
      <p className="eyebrow mb-3">Recent partner activity</p>
      <div className="flex flex-col gap-2.5">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-baseline justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link href={`/p/${entry.scope}`} className="font-medium text-fg-1">
                {companyNames[entry.scope] ?? entry.scope}
              </Link>
              <span className="text-fg-4"> · {entry.description} </span>
              <span className="text-fg-5">({actorLabel(entry.actor)})</span>
            </div>
            <div className="shrink-0 whitespace-nowrap text-xs text-fg-5">{relativeTime(entry.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
