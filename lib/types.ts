/**
 * Clean domain shapes the app renders from. Both the real Attio client
 * (lib/attio.ts) and the local fixtures (lib/fixtures.ts) produce exactly
 * this shape, so pages never know or care which one they're reading from.
 */

export type EventName = "DTM27" | "SPARTA 2027" | "DTM28" | "DTM29";

export type DeliverableStatus =
  | "Not started"
  | "In progress"
  | "Blocked"
  | "Done"
  | "N/A";

export interface PersonRef {
  recordId: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
}

/** A DTM staff member (CS lead / Sales lead), resolved from an Attio actor ID. */
export interface StaffMember {
  id: string;
  name: string;
  email: string;
}

export interface Deliverable {
  id: string;
  name: string;
  workstream: string;
  phase: string;
  status: DeliverableStatus;
  dueDate: string | null;
  quantity: number | null;
  notes: string | null;
  events: EventName[];
}

/**
 * How a company's contracted events map onto the three built variants.
 * Public Delegation is recognized but explicitly unsupported in v1 — see the
 * plan's "What Phase 1 does NOT include" section.
 */
export type PortalVariant = "dtm27" | "sparta27" | "both" | "unsupported";

export interface PortalSummary {
  companyRecordId: string;
  companyName: string;
  slug: string;
  variant: PortalVariant;
  events: EventName[];
  csStage: string | null;
  onboardingStage: string | null;
  health: string | null;
  csLeadId: string | null;
  salesLeadId: string | null;
  contractSignedDate: string | null;
  hasContract: boolean;
  invoicingStatus: string | null;
  deliverablesDone: number;
  deliverablesTotal: number;
  overdueCount: number;
  nextDeadline: string | null;
  /** What this partner owes DTM (logo/guidelines, announce, Guardians, named-attendee seats) — see lib/portal-view.ts's derivePartnerObligations. Whether each is actually done lives in Postgres, not here; deadlineDate/deadlineHard/deadlineDaysAway are null on this summary shape (only buildPortalView has the SCHEDULED_DEADLINES context to fill them in). */
  partnerObligations: {
    id: string;
    title: string;
    note: string;
    deadlineDate: string | null;
    deadlineHard: boolean;
    deadlineDaysAway: number | null;
    seatLimit: number | null;
  }[];
}

export interface PortalDetail extends PortalSummary {
  contractLink: string | null;
  poc: PersonRef | null;
  deliverables: Deliverable[];
  /**
   * Freeform notes from the CS Tracker entry. Real data has shown this field
   * often carries load-bearing caveats ("this sold item is not yet a
   * confirmed deliverable", data-entry corrections, etc.) that a naive
   * "just render the deliverables" approach would silently miss — surfaced
   * staff-only, never to partners.
   */
  internalNotes: string | null;
}
