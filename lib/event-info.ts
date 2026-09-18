import type { EventName } from "@/lib/types";

/**
 * v1 only serves the current DTM27/SPARTA27 cycle. Real Attio data has
 * multi-year deals (e.g. a DTM27+DTM28 contract) whose DTM28-tagged
 * deliverables have no due dates yet and belong to a portal that doesn't
 * exist this cycle — they must never leak into this cycle's portal.
 */
export const CURRENT_CYCLE_EVENTS: EventName[] = ["DTM27", "SPARTA 2027"];

/**
 * Hard-deadline dates from the DTM27 template ("the four dates in bold ...
 * after each one the item cannot be produced — not late, not at all").
 * A calendar fact from the Playbook, not per-partner data, so it's safe to
 * hardcode rather than needing an Attio field.
 */
export const HARD_DEADLINE_DATES = new Set([
  "2027-03-08",
  "2027-03-22",
  "2027-03-29",
  "2027-04-19",
]);

/**
 * Static event facts from the CS Playbook / DTM27 template — not deliverable
 * data, so it doesn't belong in Attio. Update here if the Playbook's dates
 * change.
 */
export const EVENT_INFO: Partial<
  Record<
    EventName,
    {
      dates: string;
      location: string;
      buildUp?: string;
      startDate: string;
      /** Short framing line for Quick Links — what kind of event this is, who it's run with. */
      context?: string;
      /** Event's own site — falls back to the main deeptech.build domain where no dedicated page is confirmed. */
      website: string;
      /** Whether a floor plan is a relevant quick link for this event. Both DTM27 and SPARTA27 have one; the actual URL is staff-editable (see lib/portal-content.ts's floorPlanUrls, set on Global portal settings), not hardcoded here. */
      hasFloorPlan?: boolean;
    }
  >
> = {
  DTM27: {
    dates: "12–13 May 2027",
    location: "Wilhelm Studios, Kopenhagener Straße 60-68, 13407 Berlin",
    buildUp: "10–11 May 2027",
    startDate: "2027-05-12",
    website: "https://www.deeptech.build/dtm27",
    hasFloorPlan: true,
  },
  "SPARTA 2027": {
    dates: "11 February 2027",
    location: "Deutsches Jagd- und Fischereimuseum, Neuhauser Str. 2, 80331 Munich",
    startDate: "2027-02-11",
    context: "Official side event of the Munich Security Conference, co-organised with TUM Venture Labs.",
    website: "https://www.deeptech.build/sparta",
    hasFloorPlan: true,
  },
};
