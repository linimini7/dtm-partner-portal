import { CURRENT_CYCLE_EVENTS, EVENT_INFO, HARD_DEADLINE_DATES } from "@/lib/event-info";
import { SCHEDULED_DEADLINES } from "@/lib/deadline-schedule";
import type { PortalContentFields } from "@/lib/portal-content";
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

export type TabId = "overview" | "assets" | "actions";

export interface PackageRow {
  label: string;
  values: string[];
  /** When set, `values[0]` renders as a hyperlink to this URL instead of plain text (e.g. an event's website). */
  href?: string;
}

/**
 * Per-event accent color, so a dual-event partner can visually tell DTM27
 * and SPARTA27 apart at a glance (day-countdown boxes, event card headers,
 * action-item chips) — matches the Claude Design mockup's exact palette
 * (SPARTA27's #7A5CF0 is a distinct purple, not the app's existing
 * --violet-400). Everything other than SPARTA27 defaults to the main DTM
 * accent.
 */
export function eventAccentVar(event: EventName): string {
  // Literal hex (not var(--accent)) so callers can safely append a hex alpha
  // suffix for a tinted chip background (e.g. `${color}16`) — see PortalShell.
  return event === "SPARTA 2027" ? "#7A5CF0" : "#D4367A";
}

/**
 * One event's card on the Overview tab — a partner sponsoring both DTM27 and
 * SPARTA27 (e.g. APEX Ventures) gets one of these per event, each with its
 * own dates/venue, deliverables and practical links, instead of a single
 * shared card mixing both events' info together, which read as one
 * confusing, undifferentiated list.
 */
export interface EventOverviewSection {
  event: EventName;
  eventLabel: string;
  accentVar: string;
  /** Null when the event has no known start date (shouldn't happen for a current-cycle event, but EVENT_INFO is a Partial). */
  daysAway: number | null;
  /** Compact date for the countdown box header (no build-up suffix) — dateLine below is the fuller version shown in the card body. */
  shortDate: string;
  dateLine: string;
  location: string;
  context?: string;
  /** Website / Floor plan / Hotel booking — practical links only; dates/location/context are their own fields above instead of being mixed into this list. */
  practicalLinks: PackageRow[];
  glanceRows: PackageRow[];
}

export interface KeyDateRow {
  date: string;
  what: string;
  workstream: string;
  hard: boolean;
}

/**
 * What the PARTNER owes DTM (every real contract's "Partner Deliverables"
 * section — logo & guidelines, announce the partnership, nominate
 * Guardians), as opposed to what DTM owes the partner (see
 * lib/dtm-deliverables.ts — DTM-internal, staff-only, never routed through
 * this file; see the warning above). Not modeled in Attio (confirmed
 * decision) — these three items repeat near-identically across every
 * contract read so far, so deriving them is a reasonable default, not an
 * invention.
 */
export interface PartnerObligation {
  id: string;
  title: string;
  note: string;
  /**
   * The closest matching Notion-sourced deadline for this obligation, if
   * any — set by buildPortalView (needs SCHEDULED_DEADLINES context this
   * function doesn't have), null here and for callers that only need the
   * plain obligation list (e.g. the /portals staff table's progress count).
   * Not every obligation has a real fixed date in the template (Guardians
   * nomination and announcing the partnership are both explicitly rolling),
   * so null also means "no invented date" for those, not "not yet computed".
   */
  deadlineDate: string | null;
  deadlineHard: boolean;
  /** Days from today to deadlineDate, clamped at 0 once passed — null alongside deadlineDate when there's no match. */
  deadlineDaysAway: number | null;
  /**
   * How many named attendees this obligation can actually hold — the sum of
   * `quantity` across the deliverable(s) that earned it (a deliverable with
   * no quantity counts as 1). Only set for the named-attendee programme
   * seats (LP-GP Marketplace, CXO/CVC Summit, Investor Dinner), where the
   * partner bought a specific number of seats and shouldn't be able to name
   * more people than that. Null everywhere else, including Guardians —
   * that one's explicitly open-ended ("the earlier you nominate, the
   * better"), not tied to a purchased quantity.
   */
  seatLimit: number | null;
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
 * A "Content / Speaking Slot" or "Co-Curated Content Session" deliverable
 * needs the partner to actually name who's presenting and what it's about —
 * two separate asks (a "nominate" obligation and a "topic" obligation
 * below), matched per deliverable (rather than just checking .some(), like
 * NAMED_ATTENDEE_PROGRAMMES does) since a dual-event partner can hold one
 * of each per event and each needs its own pair of obligations.
 */
const CONTENT_SLOT_TYPES: { idPrefix: string; match: RegExp; label: string }[] = [
  { idPrefix: "speaking", match: /speaking\s*slot/i, label: "speaking slot" },
  { idPrefix: "cocurated", match: /co-?curated/i, label: "co-curated session" },
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
      deadlineDate: null,
      deadlineHard: false,
      deadlineDaysAway: null,
      seatLimit: null,
    },
    {
      id: "announce",
      title: "Publicly announce the partnership",
      note: "A social media post or newsletter mention — once you've received your Media Kit under Tickets & assets.",
      deadlineDate: null,
      deadlineHard: false,
      deadlineDaysAway: null,
      seatLimit: null,
    },
  ];
  if (scopedEvents.includes("DTM27")) {
    partnerObligations.push({
      id: "guardians",
      title: "Nominate Guardians for the programme",
      note: "Rolling — the earlier you nominate, the better.",
      deadlineDate: null,
      deadlineHard: false,
      deadlineDaysAway: null,
      seatLimit: null,
    });
  }
  for (const programme of NAMED_ATTENDEE_PROGRAMMES) {
    const matches = deliverables.filter((d) => programme.match.test(d.name));
    if (matches.length > 0) {
      const seatLimit = matches.reduce((sum, d) => sum + (d.quantity ?? 1), 0);
      partnerObligations.push({
        id: programme.id,
        title: `Nominate your attendee(s) for ${programme.label}`,
        note: `Let us know who's coming so we can confirm their seat (Senior or C-level contacts only). You have ${seatLimit} seat${seatLimit === 1 ? "" : "s"}.`,
        deadlineDate: null,
        deadlineHard: false,
        deadlineDaysAway: null,
        seatLimit,
      });
    }
  }
  for (const slotType of CONTENT_SLOT_TYPES) {
    for (const d of deliverables) {
      if (!slotType.match.test(d.name)) continue;
      const eventLabel = d.events.map((e) => (e === "SPARTA 2027" ? "SPARTA27" : e)).join(" & ") || undefined;
      const suffix = eventLabel ? ` (${eventLabel})` : "";
      partnerObligations.push({
        id: `${slotType.idPrefix}-nominate-${d.id}`,
        title: `Nominate who's presenting your ${slotType.label}${suffix}`,
        note: "Full name, position, and email address — the DTM content team will follow up directly.",
        deadlineDate: null,
        deadlineHard: false,
        deadlineDaysAway: null,
        seatLimit: null,
      });
      partnerObligations.push({
        id: `${slotType.idPrefix}-topic-${d.id}`,
        title: `Submit a topic for your ${slotType.label}${suffix}`,
        note: "A working title is enough for now — content details get aligned with the DTM team closer to the date.",
        deadlineDate: null,
        deadlineHard: false,
        deadlineDaysAway: null,
        seatLimit: null,
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
  /** Each scoped event's own dates/venue now live on its EventOverviewSection card instead of a shared header line — see eventSections. */
  tabs: { id: TabId; label: string; staffOnly?: boolean }[];
  eventSections: EventOverviewSection[];
  hasGuardian: boolean;
  hasMeet: boolean;
  /** The actual matchmaking/1:1-meetings deliverables (e.g. "DTM100 Early Access & Co-Selection", "LP-GP Marketplace — Invitation") — for the "Who do you want to meet" card's "Curated 1:1s in your package" line. */
  matchmakingItems: Deliverable[];
  keyDates: KeyDateRow[];
  ticketItems: Deliverable[];
  hasBooth: boolean;
  boothItems: Deliverable[];
  /** What the partner owes DTM — the partner-visible Action Items tab AND the Overview tab's "What we need from you" summary (the same list, filtered to what's still open — see PortalShell). */
  partnerObligations: PartnerObligation[];
  /** The real submit-by date for logo/website/description (the one ScheduledDeadline tagged `trackedBy: "brandAssets"`), for the "Tickets & assets" tab's BrandAssetsCard — null if no such deadline applies to this partner's scoped events. */
  brandAssetsDeadline: string | null;
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
  // Always show the quantity when one exists, even "× 1" — a partner
  // shouldn't have to infer "just one" from its absence next to items that
  // do show a count.
  return d.quantity ? `${d.name} × ${d.quantity}` : d.name;
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

export function buildPortalView(
  portal: PortalDetail,
  links: Pick<PortalContentFields, "hotelBookingUrl" | "floorPlanUrls"> = {
    hotelBookingUrl: null,
    floorPlanUrls: {},
  },
): PortalView {
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
  function appliesToThisPartner(d: (typeof SCHEDULED_DEADLINES)[number]): boolean {
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
  }
  const applicableDeadlines = SCHEDULED_DEADLINES.filter(appliesToThisPartner);
  const scheduledDeadlineRows: KeyDateRow[] = applicableDeadlines.map((d) => ({
    date: d.date,
    what: d.what,
    workstream: "Partner deadline",
    hard: d.hard,
  }));

  // The real deadline for logo/website/description — shown as a "Submit by"
  // badge the same way the tickets card shows "Redeem by", regardless of
  // whether it's already complete (completion is tracked separately, off
  // real brandAssets data — see PortalShell's openPartnerObligations). A
  // dual-event partner can match both DTM27's and SPARTA27's graphic
  // submission deadlines — the earlier one is the real binding cutoff, not
  // whichever happens to come first in SCHEDULED_DEADLINES.
  const brandAssetsDeadlineEntry = applicableDeadlines
    .filter((d) => d.trackedBy === "brandAssets")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const brandAssetsDeadline = brandAssetsDeadlineEntry ? brandAssetsDeadlineEntry.date : null;

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

  // One card per scoped event — a partner sponsoring both DTM27 and SPARTA27
  // gets each event's own dates/venue, deliverables and practical links kept
  // apart, instead of merged into one undifferentiated list. Ordered
  // chronologically (whichever event happens first, e.g. SPARTA27 in
  // February, appears before DTM27 in May) rather than by raw Attio order.
  const eventSections: EventOverviewSection[] = [...scopedEvents]
    .sort((a, b) => (EVENT_INFO[a]?.startDate ?? "9999").localeCompare(EVENT_INFO[b]?.startDate ?? "9999"))
    .map((event): EventOverviewSection | null => {
      const info = EVENT_INFO[event];
      if (!info) return null;

      const practicalLinks: PackageRow[] = [
        {
          label: "Website",
          values: [info.website.replace(/^https?:\/\//, "")],
          href: info.website,
        },
      ];
      if (info.hasFloorPlan) {
        const floorPlanUrl = links.floorPlanUrls[event];
        practicalLinks.push(
          floorPlanUrl
            ? { label: "Floor plan", values: ["View floor plan"], href: floorPlanUrl }
            : { label: "Floor plan", values: ["Coming soon"] },
        );
      }
      practicalLinks.push(
        links.hotelBookingUrl
          ? { label: "Hotel booking", values: ["Book your stay"], href: links.hotelBookingUrl }
          : { label: "Hotel booking", values: ["Coming soon"] },
      );

      return {
        event,
        // Short display form for section/card titles ("SPARTA27", not the
        // full "SPARTA 2027") — the actual EventName value (above) is used
        // for filtering, the header countdown, media kit lookup, etc.
        eventLabel: event === "SPARTA 2027" ? "SPARTA27" : event,
        accentVar: eventAccentVar(event),
        daysAway: daysUntil(info.startDate),
        shortDate: info.dates,
        dateLine: info.buildUp ? `${info.dates} · Build-up ${info.buildUp}` : info.dates,
        location: info.location,
        context: info.context,
        practicalLinks,
        glanceRows: packageRowsFor(deliverables.filter((d) => d.events.includes(event))),
      };
    })
    .filter((s): s is EventOverviewSection => s !== null);

  // Guardians attend DTM27 itself, so nominating them only makes sense for
  // partners actually sponsoring DTM27 — not a SPARTA27-only partner.
  const hasGuardian = scopedEvents.includes("DTM27");

  // Attaches the closest logically-matching Notion "Your key dates" entry
  // to each real partner obligation, since staff asked for the dates back
  // on "What we need from you" without reintroducing the internal DTM
  // logistics milestones (booth details, add-ons, etc.) that used to bloat
  // it — see the conversation this was scoped down in. Not every obligation
  // has a genuine match: "announce" and "guardians" are explicitly rolling
  // in every template read so far, so they stay dateless rather than being
  // pinned to an invented deadline.
  function deadlineForObligation(obligationId: string): (typeof applicableDeadlines)[number] | undefined {
    if (obligationId === "logo") return brandAssetsDeadlineEntry;
    if (obligationId === "announce" || obligationId === "guardians") return undefined;
    // Speaking slots and co-curated sessions both ride on the template's own
    // "speaker details" cutoff — the closest real signal for "who's
    // presenting and what it's about" (there's no separate co-curated-
    // session deadline in the Notion template, so it borrows the same one).
    if (obligationId.startsWith("speaking-") || obligationId.startsWith("cocurated-")) {
      return applicableDeadlines.find((d) => /speaker details/i.test(d.what));
    }
    // Named-attendee programme seats (LP-GP Marketplace, CXO/CVC Summit,
    // Investor Dinner) — the template's own "who's attending" cutoff is the
    // closest real signal for "tell us who's coming".
    return applicableDeadlines.find((d) => /attend|matchmaking/i.test(d.what));
  }
  const partnerObligations = derivePartnerObligations(scopedEvents, deliverables).map((o) => {
    const match = deadlineForObligation(o.id);
    return {
      ...o,
      deadlineDate: match?.date ?? null,
      deadlineHard: match?.hard ?? false,
      deadlineDaysAway: match ? daysUntil(match.date) : null,
    };
  });

  const tabs: { id: TabId; label: string; staffOnly?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "assets", label: "Tickets & assets" },
    { id: "actions", label: "Action items" },
  ];

  return {
    companyName: portal.companyName,
    eventLabel: scopedEvents.map((e) => (e === "SPARTA 2027" ? "SPARTA27" : e)).join(" & "),
    tabs,
    eventSections,
    hasGuardian,
    hasMeet: matchmaking.length > 0,
    matchmakingItems: matchmaking,
    keyDates,
    ticketItems: passes,
    hasBooth: booth.length > 0,
    boothItems: booth,
    partnerObligations,
    brandAssetsDeadline,
    workstreamsPresent: Array.from(new Set(deliverables.map((d) => d.workstream))).filter(Boolean),
    contractLink: portal.contractLink,
    contractSignedDate: portal.contractSignedDate,
  };
}
