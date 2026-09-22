import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPortalBySlug } from "@/lib/data";
import { EVENT_INFO } from "@/lib/event-info";
import { DTM_DELIVERABLES, dtmDeliverableAppliesToEvents } from "@/lib/dtm-deliverables";
import { getDeliverableStatuses } from "@/lib/dtm-deliverable-status";
import { workstreamDisplayName } from "@/lib/portal-view";
import type { EventName } from "@/lib/types";
import DeliverablesTracker, { type TrackerDeliverable, type WorkstreamCard } from "./DeliverablesTracker";

const NOTION_SOURCE_URL =
  "https://app.notion.com/p/deep-tech-momentum/a3b42beac2ea4badbb32c8943bd9ee0a?v=1771aac97bdf47adb7c124c3d6093d6f&source=copy_link";

/** All ten Notion "Workstream" options, in the CS Playbook's own order — fixes the workstream cards' left-to-right order regardless of which ones a given partner triggers. */
const WORKSTREAM_ORDER = [
  "CS spine",
  "Passes & Access",
  "Exhibition / Booth",
  "Content & Programming",
  "Branding & Design",
  "Marketing & Comms",
  "Guardian Co-Invitation",
  "Matchmaking / Product",
  "Finance",
  "Sales",
];

/** Workstreams with no partner-purchased-deliverable equivalent in Attio — internal operating lanes that apply to every signed partner regardless of what they bought, so they're always "in scope" rather than gated by the partner's own deliverable list. */
const ALWAYS_IN_SCOPE = new Set(["CS spine", "Sales", "Finance"]);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso + "T00:00:00Z").getTime() - new Date(fromIso + "T00:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

function eventLabel(event: EventName): string {
  return event === "SPARTA 2027" ? "SPARTA27" : event;
}

export default async function DtmDeliverablesPage({ params }: PageProps<"/p/[slug]/admin/deliverables">) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { slug } = await params;
  const portal = await getPortalBySlug(slug);
  if (!portal) notFound();

  const relevant = DTM_DELIVERABLES.filter((d) => dtmDeliverableAppliesToEvents(d, portal.events));
  const statuses = await getDeliverableStatuses(slug);
  const merged: TrackerDeliverable[] = relevant.map((d) => ({
    id: d.id,
    milestone: d.milestone,
    detail: d.detail,
    event: d.event,
    workstream: d.workstream,
    ownerRole: d.ownerRole,
    date: d.date,
    hardWall: d.hardWall,
    status: statuses[d.id] ?? "not_started",
  }));

  const partnerWorkstreams = new Set(
    portal.deliverables.map((d) => workstreamDisplayName(d.workstream)).filter(Boolean),
  );
  const presentWorkstreams = new Set(merged.map((d) => d.workstream));

  const workstreamCards: WorkstreamCard[] = WORKSTREAM_ORDER.filter((ws) => presentWorkstreams.has(ws)).map((ws) => {
    const items = merged.filter((d) => d.workstream === ws);
    const done = items.filter((d) => d.status === "done").length;
    const nextDue =
      items.filter((d) => d.status !== "done").sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date ?? null;
    return {
      workstream: ws,
      inScope: ALWAYS_IN_SCOPE.has(ws) || partnerWorkstreams.has(ws),
      total: items.length,
      done,
      nextDue,
    };
  });

  const today = todayIso();
  const in30 = addDaysIso(today, 30);
  const overdue = merged.filter((d) => d.status !== "done" && d.date < today).length;
  const dueIn30 = merged.filter((d) => d.status !== "done" && d.date >= today && d.date <= in30).length;
  const waitingOnPartner = merged.filter((d) => d.status === "waiting_on_partner").length;
  const inProgress = merged.filter((d) => d.status === "in_progress").length;

  const nextAction = merged.filter((d) => d.status !== "done").sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;

  const currentEvents = portal.events.filter((e): e is EventName => Boolean(EVENT_INFO[e]));
  const nextEvent = currentEvents
    .map((e) => ({ event: e, startDate: EVENT_INFO[e]!.startDate }))
    .filter((e) => e.startDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div
        className="flex items-center gap-3 rounded-[var(--radius-panel)] border px-4 py-3"
        style={{ borderColor: "var(--alert)", background: "var(--alert-wash)" }}
      >
        <span
          className="shrink-0 rounded-[var(--radius-chip)] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--alert)", background: "rgb(232 107 107 / 16%)" }}
        >
          DTM internal
        </span>
        <p className="text-[12.5px] text-fg-3">
          Never share this page with a partner. It is a separate page from the partner portal for
          exactly that reason — do not paste these blocks into the shared portal.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/p/${slug}/admin`} className="text-sm">
            ← {portal.companyName} admin
          </Link>
          <p className="eyebrow mt-2 mb-1">Internal deliverable tracker</p>
          <h1 className="text-2xl text-fg-1">{portal.companyName} — what DTM owes</h1>
          <p className="mt-1 text-sm text-fg-4">
            {currentEvents.map((e, i) => (
              <span key={e}>
                {i > 0 && "  ·  "}
                {eventLabel(e)} · {EVENT_INFO[e]!.dates}
                {EVENT_INFO[e]!.location ? `, ${EVENT_INFO[e]!.location.split(",").pop()?.trim()}` : ""}
              </span>
            ))}
          </p>
        </div>
        <div className="flex shrink-0 gap-6 text-right">
          <div>
            <p className="eyebrow mb-1">Next DTM action</p>
            <p className="font-mono text-lg" style={{ color: "var(--warn)" }}>
              {nextAction ? nextAction.date : "—"}
            </p>
          </div>
          {nextEvent && (
            <div>
              <p className="eyebrow mb-1">Days to {eventLabel(nextEvent.event)}</p>
              <p className="text-2xl font-semibold text-fg-1">{daysBetween(today, nextEvent.startDate)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {[
          { n: overdue, label: "Overdue", note: "Past the date and not done", color: overdue > 0 ? "var(--alert)" : "var(--fg-1)" },
          { n: dueIn30, label: "Due in 30 days", note: "Needs work started now", color: dueIn30 > 0 ? "var(--warn)" : "var(--fg-1)" },
          {
            n: waitingOnPartner,
            label: "Waiting on partner",
            note: "Chase the partner, do not wait",
            color: waitingOnPartner > 0 ? "var(--violet-400)" : "var(--fg-1)",
          },
          { n: inProgress, label: "In progress", note: "Actively being worked", color: "var(--fg-1)" },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-4">
            <p className="text-3xl font-semibold" style={{ color: s.color }}>
              {s.n}
            </p>
            <p className="eyebrow mt-2 mb-1">{s.label}</p>
            <p className="text-[12px] text-fg-5">{s.note}</p>
          </div>
        ))}
      </div>

      <DeliverablesTracker
        slug={slug}
        workstreamOrder={WORKSTREAM_ORDER}
        workstreamCards={workstreamCards}
        deliverables={merged}
      />

      <p className="border-t border-dtm-hairline pt-4 text-[12px] text-fg-5">
        Source of truth:{" "}
        <a href={NOTION_SOURCE_URL} target="_blank" rel="noreferrer">
          CS Timeline | DTM27 &amp; SPARTA27 ↗
        </a>{" "}
        on Notion. To change a milestone, date, owner or detail — edit it there, then ask for this
        page to be re-synced. Editing here only changes this partner&apos;s status, never the
        underlying schedule.
      </p>
    </main>
  );
}
