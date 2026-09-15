import type { EventName } from "@/lib/types";

/**
 * The calendar-fixed deadlines from the real DTM27 / SPARTA27 / combined
 * partner-portal Notion templates ("Your key dates") — see the conversation
 * this was added in: staff noticed the Key Dates tab was nearly empty
 * because it only ever drew from Attio Deliverables' due_date field, which
 * is sparsely populated. These dates are calendar facts from the Playbook
 * template, not per-partner Attio data (same reasoning as
 * event-info.ts's HARD_DEADLINE_DATES), so they're hardcoded here and
 * merged into keyDates in lib/portal-view.ts alongside whatever real
 * deliverable due-dates exist.
 *
 * `appliesTo` mirrors the template's "Applies if" column. "everyone" always
 * applies; the others are only shown to a partner where buildPortalView can
 * actually tell — "shipping" has no dedicated Attio signal, so it rides
 * along with "exhibiting" (booth partners are the ones who ship things to
 * the venue in practice) rather than being invented as its own field.
 */

export type DeadlineAudience = "everyone" | "exhibiting" | "speaking" | "shipping";

export interface ScheduledDeadline {
  date: string; // YYYY-MM-DD
  what: string;
  appliesTo: DeadlineAudience;
  hard: boolean;
  events: EventName[];
}

export const SCHEDULED_DEADLINES: ScheduledDeadline[] = [
  // ---- DTM27 (from the DTM27 and combined templates) ----
  {
    date: "2027-01-25",
    what: "High-resolution logo, click-through URL and company description (up to 250 characters)",
    appliesTo: "everyone",
    hard: false,
    events: ["DTM27"],
  },
  {
    date: "2027-02-22",
    what: "Booth details confirmed: type, size, unit, DTM Market vertical, lead scanning — plus any oversized demo, extra power or F&B needs",
    appliesTo: "exhibiting",
    hard: false,
    events: ["DTM27"],
  },
  {
    date: "2027-02-22",
    what: "Speaker details: high-res photo, job title, company, event-day mobile",
    appliesTo: "speaking",
    hard: false,
    events: ["DTM27"],
  },
  {
    date: "2027-03-01",
    what: "Add-on selection locked — furniture, screens, catering, WiFi, fridge",
    appliesTo: "exhibiting",
    hard: false,
    events: ["DTM27"],
  },
  {
    date: "2027-03-08",
    what: "All logistics and add-on orders close",
    appliesTo: "exhibiting",
    hard: true,
    events: ["DTM27"],
  },
  {
    date: "2027-03-22",
    what: "Booth design and artwork submitted",
    appliesTo: "exhibiting",
    hard: true,
    events: ["DTM27"],
  },
  {
    date: "2027-03-29",
    what: "Final graphics submission — everything goes to print the following week",
    appliesTo: "exhibiting",
    hard: true,
    events: ["DTM27"],
  },
  {
    date: "2027-04-19",
    what: "Presentation deck submitted",
    appliesTo: "speaking",
    hard: true,
    events: ["DTM27"],
  },
  {
    date: "2027-04-19",
    what: "All partner passes redeemed",
    appliesTo: "everyone",
    hard: true,
    events: ["DTM27"],
  },
  {
    date: "2027-04-26",
    what: "Delivery and pick-up windows reported",
    appliesTo: "shipping",
    hard: false,
    events: ["DTM27"],
  },
  {
    date: "2027-05-03",
    what: "Full attendee list — names for badges",
    appliesTo: "everyone",
    hard: false,
    events: ["DTM27"],
  },
  {
    date: "2027-05-10",
    what: "Physical items at the venue — 48 hours before day one",
    appliesTo: "shipping",
    hard: false,
    events: ["DTM27"],
  },

  // ---- SPARTA27 (from the SPARTA27 and combined templates) ----
  // "Within 2 weeks of onboarding" in the template has no fixed calendar
  // date (it floats per partner) — deliberately left out rather than
  // guessing an onboarding date; the partner obligations checklist already
  // covers "submit your logo".
  {
    date: "2026-11-02",
    what: "Session topic and brief confirmed — the agenda closes and goes live on this date",
    appliesTo: "speaking",
    hard: false,
    events: ["SPARTA 2027"],
  },
  {
    date: "2026-11-09",
    what: "Speaker details: high-res photo, job title, company, event-day mobile",
    appliesTo: "speaking",
    hard: true,
    events: ["SPARTA 2027"],
  },
  {
    date: "2026-12-21",
    what: "Final graphics submission — lounge, session and branding artwork",
    appliesTo: "exhibiting",
    hard: true,
    events: ["SPARTA 2027"],
  },
  {
    date: "2026-12-21",
    what: "Names of everyone attending — applications and partner matchmaking close",
    appliesTo: "everyone",
    hard: true,
    events: ["SPARTA 2027"],
  },
  {
    date: "2027-01-18",
    what: "Presentation deck submitted",
    appliesTo: "speaking",
    hard: true,
    events: ["SPARTA 2027"],
  },
  {
    date: "2027-01-28",
    what: "Platform profile complete and search preferences submitted — preferences freeze and curation begins",
    appliesTo: "everyone",
    hard: true,
    events: ["SPARTA 2027"],
  },
  {
    date: "2027-02-09",
    what: "Confirm all scheduled 1:1s in your calendar by 19:00 CET",
    appliesTo: "everyone",
    hard: true,
    events: ["SPARTA 2027"],
  },
  {
    date: "2027-02-09",
    what: "Physical items at the venue — 48 hours before",
    appliesTo: "shipping",
    hard: false,
    events: ["SPARTA 2027"],
  },
];
