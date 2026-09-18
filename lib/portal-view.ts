import { CURRENT_CYCLE_EVENTS, EVENT_INFO, HARD_DEADLINE_DATES } from "@/lib/event-info";
import { SCHEDULED_DEADLINES } from "@/lib/deadline-schedule";
import type { Workstream } from "@/lib/portal-config";
import type { Deliverable, EventName, PortalDetail } from "@/lib/types";

/**
 * Reshapes a PortalDetail (real Attio data) into exactly what the tabbed
 * portal UI needs to render. Kept separate from the UI so the interactive
 * shell component stays focused on rendering/interactivity, not data shape.
 *
 * Two real data gaps, resolved by substituting a real field rather than
 * inventing one (see the conversation this was built in):
 *  - The design's "Owner: DTM/Partner" chip has no backing Attio field —
 *    every deliverable's `phase` (Onboarding/Fulfilment/Event/Wrap) is shown
 *    in that slot instead, since it's real and still informative.
 *  - Guardian nomination counts and ticket redemption codes don't exist in
 *    Attio yet — rendered as "not yet tracked" rather than a fake number.
 *
 * IMPORTANT: this view model is passed as props into a client component
 * (PortalShell) and this page has no auth gate for partners (see
 * lib/portal-code.ts) — every field here reaches the browser's page source
 * whether or not the UI renders it. Never add `internalNotes` or
 * `invoicingStatus` (or anything else staff-only) to this type; those live
 * only in the server-rendered /p/[slug]/admin page, built directly from
 * PortalDetail, never routed through this file.
 */

export type TabId = "overview" | "dates" | "assets" | "actions";

export interface PackageRow {
  label: string;
  values: string[];
  /** When set, `values[0]` renders as a hyperlink to this URL instead of plain text (e.g. an event's website). */
  href?: string;
}

/**
 * The Overview tab's Quick Links + "Your partnership at a glance" pairing,
 * scoped to one event. A partner sponsoring both DTM27 and SPARTA27 (e.g. PA
 * Consulting Group) gets one of these per event — each with its own quick
 * links and its own deliverables — instead of a single shared card mixing
 * both events' info together, which read as one confusing, undifferentiated
 * list.
 */
export interface EventOverviewSection {
  event: EventName;
  eventLabel: string;
  quickLinks: PackageRow[];
  glanceRows: PackageRow[];
}

export interface KeyDateRow {
  date: string;
  what: string;
  workstream: string;
  hard: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  phase: string;
  due: string | null;
}

/**
 * What the PARTNER owes DTM (every real contract's "Partner Deliverables"
 * section — logo & guidelines, announce the partnership, nominate
 * Guardians), as opposed to `ActionItem` which is what DTM owes the
 * partner. Not modeled in Attio (confirmed decision) — these three items
 * repeat near-identically across every contract read so far, so deriving
 * them is a reasonable default, not an invention.
 */
export interface PartnerObligation {
  id: string;
  title: string;
  note: string;
}

// Programme seats (CXO Summit / CVC Summit / LP-GP Marketplace) and
// Investor Dinner seats each need a partner to name real attendees — per
// the CS Playbook's configuration matrix ("Programme seats... Section 3 +
// action item... which programme, how many, named attendees"). Matched by
// deliverable name rather than a dedicated Attio field, since that's all
// that currently distinguishes these — same reasoning as HARD_DEADLINE_DATES.
const NAMED_ATTENDEE_PROGRAMMES: { id: string; match: RegExp; label: string }[] = [
  { id: "programme-lpgp", match: /lp[\s-]*gp\s*marketplace/i, label: "the LP-GP Marketplace" },
  { id: "programme-cxo", match: /cxo\s*summit/i, label: "the CXO Summit" },
  { id: "programme-cvc", match: /cvc\s*summit/i, label: "the CVC Summit" },
  { id: "investor-dinner", match: /investor.*dinner/i, label: "the investor dinner" },
];

/**
 * What a partner owes DTM under contract Section 5 — logo/guidelines and
 * announcing the partnership always apply; Guardians and named-attendee
 * programme seats only apply when the partner actually bought them.
 * Standalone (not just inlined into buildPortalView) so the /portals staff
 * table can derive the same obligation list per company without needing a
 * full PortalView.
 */
export function derivePartnerObligations(scopedEvents: EventName[], deliverables: Deliverable[]): PartnerObligation[] {
  const partnerObligations: PartnerObligation[] = [
    {
      id: "logo",
      title: "Submit your logo & brand guidelines",
      note: "So we can start using it across signage and campaign materials.",
    },
    {
      id: "announce",
      title: "Publicly announce the partnership",
      note: "A social media post or newsletter mention — whenever you're ready.",
    },
  ];
  if (scopedEvents.includes("DTM27")) {
    partnerObligations.push({
      id: "guardians",
      title: "Nominate Guardians for the programme",
      note: "Rolling — the earlier you nominate, the better.",
    });
  }
  for (const programme of NAMED_ATTENDEE_PROGRAMMES) {
    if (deliverables.some((d) => programme.match.test(d.name))) {
      partnerObligations.push({
        id: programme.id,
        title: `Nominate your attendee(s) for ${programme.label}`,
        note: "Let us know who's coming so we can confirm their seat.",
      });
    }
  }
  return partnerObligations;
}

/**
 * Collapses a partner's obligation list into one "X out of Y" progress
 * count for the staff table — "logo" counts as 3 sub-items (logo, website,
 * description) since those tick independently; every other obligation is a
 * single manually-checked item.
 */
export function getPartnerObligationProgress(
  partnerObligations: PartnerObligation[],
  brandAssets: { logoSlots: { hasImage: boolean }[]; websiteUrl: string | null; description: string | null },
  checkedObligationIds: Set<string>,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const o of partnerObligations) {
    if (o.id === "logo") {
      total += 3;
      if (brandAssets.logoSlots.some((s) => s.hasImage)) done++;
      if (brandAssets.websiteUrl) done++;
      if (brandAssets.description) done++;
    } else {
      total += 1;
      if (checkedObligationIds.has(o.id)) done++;
    }
  }
  return { done, total };
}

export interface PortalView {
  companyName: string;
  eventLabel: string;
  headerSubtitle: string;
  /** One entry per scoped event — two for a partner sponsoring both DTM27 and SPARTA27. */
  daysToEvents: { label: string; value: number }[];
  tabs: { id: TabId; label: string; staffOnly?: boolean }[];
  eventSections: EventOverviewSection[];
  hasGuardian: boolean;
  hasMeet: boolean;
  keyDates: KeyDateRow[];
  ticketItems: Deliverable[];
  hasBooth: boolean;
  boothItems: Deliverable[];
  /** Every DTM-owed deliverable, for the staff-only Key Dates checklist. */
  deliverableChecklist: ActionItem[];
  /** What the partner owes DTM — the partner-visible Action Items tab. */
  partnerObligations: PartnerObligation[];
  workstreamsPresent: string[];
  contractLink: string | null;
  contractSignedDate: string | null;
}

function byWorkstream(deliverables: Deliverable[], workstream: Workstream): Deliverable[] {
  return deliverables.filter((d) => d.workstream === workstream);
}

/**
 * Two deliverables can share the same catalogue name (e.g. Durst Group has
 * two separate "DTM27 Pass — General Admission" records — 5 for Durst Group
 * itself, 3 for its subsidiary D3-AM S.r.l.) — joining bare names then
 * produces a confusing exact duplicate. Annotate with quantity instead of
 * merging them: the two rows exist because they're contractually distinct
 * (different recipient), not because of a data error.
 */
export function formatDeliverableName(d: Deliverable): string {
  return d.quantity && d.quantity > 1 ? `${d.name} × ${d.quantity}` : d.name;
}

/**
 * True for the overarching space allocation itself (e.g. "Booth Space —
 * 4x4m", "Meeting Lounge"), as opposed to a furniture/screen/carpet sub-item
 * within it. Matched by the deliverable's name *starting* with Booth/Lounge
 * rather than merely containing it — "Carpet (booth)" mentions "booth" too,
 * but is a sub-item, not the space itself.
 *
 * The space atom's raw Attio name ("Booth Space — 4x4m") gets swapped for
 * the real sold bundle's name ("4x4m Booth") before this ever sees it — see
 * lib/attio.ts's getDeliverablesForCompany — so also match that bundle
 * naming ("2x4m Booth", "4x8m Booth", ...) or it'd stop sorting first.
 */
function isOverarchingBoothItem(d: Deliverable): boolean {
  return /^(booth|lounge)\b/i.test(d.name.trim()) || /^\d+x\d+m booth\b/i.test(d.name.trim());
}

function boothItemOrder(a: Deliverable, b: Deliverable): number {
  const aFirst = isOverarchingBoothItem(a);
  const bFirst = isOverarchingBoothItem(b);
  if (aFirst === bFirst) return 0;
  return aFirst ? -1 : 1;
}

function daysUntil(iso: string): number {
  const ms = new Date(iso + "T00:00:00Z").getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Attio's real "Matchmaking / Sourcing" select option is displayed as
 * "Matchmaking / Product" per the CS Playbook's canonical workstream
 * naming (Notion: "1 · The CS model") — display-only, so it doesn't touch
 * the raw value anything else here matches/filters on.
 */
export function workstreamDisplayName(workstream: string): string {
  return workstream === "Matchmaking / Sourcing" ? "Matchmaking / Product" : workstream;
}

// Friendly label + display order for "Your partnership at a glance". A
// deliverable whose workstream isn't listed here still gets a row (labeled
// with its raw workstream value) — see the loop below — specifically so a
// new/renamed Attio workstream can never silently vanish from the summary
// the way "Marketing & Comms" once did here.
const WORKSTREAM_LABELS: Partial<Record<Workstream, string>> = {
  "Passes & Access": "Tickets & access",
  "Exhibition / Booth": "Booth",
  "Content & Programming": "Content",
  "Guardian Co-Invitation": "Guardian co-invitations",
  "Matchmaking / Sourcing": "Double opt-in 1:1 meetings",
  "Branding & Design": "Activations & branding",
  "Marketing & Comms": "Marketing & digital",
};
const WORKSTREAM_ORDER: Workstream[] = [
  "Passes & Access",
  "Exhibition / Booth",
  "Content & Programming",
  "Guardian Co-Invitation",
  "Matchmaking / Sourcing",
  "Branding & Design",
  "Marketing & Comms",
];

export function buildPortalView(portal: PortalDetail): PortalView {
  const deliverables = portal.deliverables;

  const booth = byWorkstream(deliverables, "Exhibition / Booth");
  const matchmaking = byWorkstream(deliverables, "Matchmaking / Sourcing");
  const passes = byWorkstream(deliverables, "Passes & Access");

  // Group a set of deliverables by their actual workstream value, not just
  // the ones this file happens to name — see WORKSTREAM_LABELS above.
  function packageRowsFor(items: Deliverable[]): PackageRow[] {
    const byWs = new Map<string, Deliverable[]>();
    for (const d of items) {
      if (!d.workstream) continue;
      const list = byWs.get(d.workstream) ?? [];
      list.push(d);
      byWs.set(d.workstream, list);
    }
    const orderedWorkstreams = [
      ...WORKSTREAM_ORDER.filter((ws) => byWs.has(ws)),
      ...Array.from(byWs.keys()).filter((ws) => !WORKSTREAM_ORDER.includes(ws as Workstream)),
    ];

    const rows: PackageRow[] = [];
    for (const ws of orderedWorkstreams) {
      const wsItems = byWs.get(ws)!;
      // The overarching space (the booth/lounge allocation itself) reads
      // first, with its furniture/screens/etc. sub-items listed after —
      // rather than in whatever order Attio happens to return them.
      const orderedItems =
        ws === "Exhibition / Booth" ? [...wsItems].sort(boothItemOrder) : wsItems;
      rows.push({
        label: WORKSTREAM_LABELS[ws as Workstream] ?? ws,
        values: orderedItems.map(formatDeliverableName),
      });
    }
    const itemsWrap = items.filter((d) => d.phase === "Wrap");
    if (itemsWrap.length > 0) {
      rows.push({ label: "After the event", values: itemsWrap.map(formatDeliverableName) });
    }
    return rows;
  }

  const scopedEvents = portal.events.filter((e): e is EventName =>
    CURRENT_CYCLE_EVENTS.includes(e as EventName),
  );

  // "Speaking" isn't tracked as its own flag anywhere — a Content &
  // Programming deliverable is the same signal the removed Agenda tab used
  // to gate on, reused here only to decide which template deadlines apply.
  const hasSpeakingSlot = byWorkstream(deliverables, "Content & Programming").length > 0;

  // The Notion template's "Your key dates" table (see lib/deadline-schedule.ts)
  // is calendar-fixed, not per-partner Attio data, so it's merged in here
  // rather than relying solely on Attio Deliverables' sparsely-populated
  // due_date field.
  const scheduledDeadlineRows: KeyDateRow[] = SCHEDULED_DEADLINES.filter((d) => {
    if (!d.events.some((e) => scopedEvents.includes(e))) return false;
    switch (d.appliesTo) {
      case "everyone":
        return true;
      // No dedicated "shipping" signal exists — booth partners are the ones
      // who ship things to the venue in practice, so it rides along with
      // "exhibiting" rather than being invented as its own Attio field.
      case "exhibiting":
      case "shipping":
        return booth.length > 0;
      case "speaking":
        return hasSpeakingSlot;
      default:
        return false;
    }
  }).map((d) => ({
    date: d.date,
    what: d.what,
    workstream: "Partner deadline",
    hard: d.hard,
  }));

  const keyDates: KeyDateRow[] = [
    ...deliverables
      .filter((d) => d.dueDate)
      .map((d) => ({
        date: d.dueDate!,
        what: formatDeliverableName(d),
        workstream: d.workstream,
        hard: HARD_DEADLINE_DATES.has(d.dueDate!),
      })),
    ...scheduledDeadlineRows,
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Every DTM-owed deliverable — this is the full internal ops checklist,
  // now staff-only (merged in from the old partner-facing Action Items tab).
  const deliverableChecklist: ActionItem[] = [...deliverables]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .map((d) => ({ id: d.id, title: formatDeliverableName(d), phase: d.phase || "—", due: d.dueDate }));

  // One Quick Links + "Your partnership at a glance" pairing per scoped
  // event — a partner sponsoring both DTM27 and SPARTA27 gets each event's
  // own quick links and deliverables kept apart, instead of merged into one
  // undifferentiated list. Row labels stay short ("Dates", "Website", ...)
  // since the event name already sits in the section/card heading. Ordered
  // chronologically (whichever event happens first, e.g. SPARTA27 in
  // February, appears before DTM27 in May) rather than by raw Attio order.
  const eventSections: EventOverviewSection[] = [...scopedEvents]
    .sort((a, b) => (EVENT_INFO[a]?.startDate ?? "9999").localeCompare(EVENT_INFO[b]?.startDate ?? "9999"))
    .map((event) => {
      const info = EVENT_INFO[event];
      if (!info) return null;
      const quickLinks: PackageRow[] = [
        {
          label: "Dates",
          values: [info.buildUp ? `${info.dates} · Build-up ${info.buildUp}` : info.dates],
        },
        { label: "Location", values: [info.location] },
      ];
      if (info.context) {
        quickLinks.push({ label: "Context", values: [info.context] });
      }
      quickLinks.push({
        label: "Website",
        values: [info.website.replace(/^https?:\/\//, "")],
        href: info.website,
      });
      if (info.hasFloorPlan) {
        quickLinks.push({ label: "Floor plan", values: ["Coming soon"] });
      }
      quickLinks.push({ label: "Hotel booking", values: ["Coming soon"] });

      return {
        event,
        // Short display form for section/card titles ("SPARTA27", not the
        // full "SPARTA 2027") — the actual EventName value (above) is used
        // for filtering, the header countdown, media kit lookup, etc.
        eventLabel: event === "SPARTA 2027" ? "SPARTA27" : event,
        quickLinks,
        glanceRows: packageRowsFor(deliverables.filter((d) => d.events.includes(event))),
      };
    })
    .filter((s): s is EventOverviewSection => s !== null);

  // One countdown per scoped event — a dual-event partner sees both, not
  // just whichever event happened to be first in the raw Attio list.
  const daysToEvents = scopedEvents
    .map((e) => {
      const startDate = EVENT_INFO[e]?.startDate;
      return startDate ? { label: `Days to ${e}`, value: daysUntil(startDate) } : null;
    })
    .filter((d): d is { label: string; value: number } => d !== null);

  // Guardians attend DTM27 itself, so nominating them only makes sense for
  // partners actually sponsoring DTM27 — not a SPARTA27-only partner.
  const hasGuardian = scopedEvents.includes("DTM27");

  const partnerObligations = derivePartnerObligations(scopedEvents, deliverables);

  const tabs: { id: TabId; label: string; staffOnly?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "assets", label: "Tickets & assets" },
    { id: "actions", label: "Action items" },
    { id: "dates", label: "DTM Deliverables", staffOnly: true },
  ];

  return {
    companyName: portal.companyName,
    eventLabel: scopedEvents.join(" & "),
    headerSubtitle: scopedEvents
      .map((e) => {
        const info = EVENT_INFO[e];
        return info ? `${info.dates} · ${info.location}` : null;
      })
      .filter((s): s is string => !!s)
      .join(" · "),
    daysToEvents,
    tabs,
    eventSections,
    hasGuardian,
    hasMeet: matchmaking.length > 0,
    keyDates,
    ticketItems: passes,
    hasBooth: booth.length > 0,
    boothItems: booth,
    deliverableChecklist,
    partnerObligations,
    workstreamsPresent: Array.from(new Set(deliverables.map((d) => d.workstream))).filter(Boolean),
    contractLink: portal.contractLink,
    contractSignedDate: portal.contractSignedDate,
  };
}
