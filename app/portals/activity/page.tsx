import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPortalCompanies } from "@/lib/data";
import { getRecentActivity } from "@/lib/activity-log";

/** e.g. "3m ago", "2h ago", "5d ago" — mirrors ActivityFeed's helper. */
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

function actorLabel(actor: string): string {
  if (actor.startsWith("partner:")) return "Partner";
  if (actor.endsWith("@deeptech.build")) return "Staff";
  return actor;
}

// A generous cap rather than true pagination — the activity log is still
// young, so "all of it" and "the last few hundred" are the same thing in
// practice for now.
const ACTIVITY_PAGE_LIMIT = 500;

export default async function AllActivityPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const [entries, companies] = await Promise.all([
    getRecentActivity(ACTIVITY_PAGE_LIMIT),
    listPortalCompanies(),
  ]);
  const companyNames = Object.fromEntries(companies.map((c) => [c.slug, c.companyName]));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">DTM Partner Portal · Staff</p>
          <h1 className="text-3xl">All partner activity</h1>
        </div>
        <Link href="/portals" className="text-sm">
          ← Back to portals
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-4">
          <p className="text-sm text-fg-4">Nothing yet — this fills in as partners make changes.</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-4">
          <p className="mb-3 text-xs text-fg-5">
            Showing the last {entries.length} change{entries.length === 1 ? "" : "s"}, newest first.
          </p>
          <div className="flex flex-col gap-2.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-baseline justify-between gap-3 border-b border-dtm-hairline pb-2.5 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link href={`/p/${entry.scope}`} className="font-medium text-fg-1">
                    {companyNames[entry.scope] ?? entry.scope}
                  </Link>
                  <span className="text-fg-4"> · {entry.description} </span>
                  <span className="text-fg-5">({actorLabel(entry.actor)})</span>
                </div>
                <div className="shrink-0 whitespace-nowrap text-xs text-fg-5">
                  {relativeTime(entry.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
