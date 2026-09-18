import { derivePartnerObligations } from "@/lib/portal-view";
import { slugify } from "@/lib/slug";
import type {
  Deliverable,
  PortalDetail,
  PortalSummary,
  StaffMember,
} from "@/lib/types";

/**
 * Synthetic sample data — no real company, person, or Attio record appears
 * here — used so the app can be built and demoed end to end before a real
 * ATTIO_API_KEY is configured. lib/data.ts uses this file automatically
 * whenever ATTIO_API_KEY is unset, which is also what makes the app usable
 * straight out of a fresh clone.
 *
 * Deliberately kept as three different shapes rather than three clean
 * examples, mirroring real edge cases this app has to handle:
 *  - Nova Materials: one event only, zero exploded deliverables yet — the
 *    empty-state case every company without deliverables exploded hits.
 *  - Brightline Robotics: a different event, contract on file but no
 *    deliverables exploded yet either — a data-entry-gap case.
 *  - Vertex Dynamics: both events, real exploded deliverables and a
 *    contract on file — the "everything present" case.
 */

const STAFF_DIRECTORY: Record<string, StaffMember> = {
  "717a8af5-949d-43aa-953c-05cc40682d70": {
    id: "717a8af5-949d-43aa-953c-05cc40682d70",
    name: "Dana Okafor",
    email: "dana@example.com",
  },
  "62f3c3c5-ab03-4765-b2bd-4bc7c5fd8af1": {
    id: "62f3c3c5-ab03-4765-b2bd-4bc7c5fd8af1",
    name: "Priya Kapoor",
    email: "priya@example.com",
  },
  "9c951c16-72ee-435e-9b77-c6d570dc128a": {
    id: "9c951c16-72ee-435e-9b77-c6d570dc128a",
    name: "Tom Bricker",
    email: "tom@example.com",
  },
  "8c39d280-455d-4e6a-be8c-56b15cecea02": {
    id: "8c39d280-455d-4e6a-be8c-56b15cecea02",
    name: "Robin Vale",
    email: "robin@example.com",
  },
  "09cec7a6-eb7e-4a16-b09b-3e0abd0845a3": {
    id: "09cec7a6-eb7e-4a16-b09b-3e0abd0845a3",
    name: "Sam Winters",
    email: "sam@example.com",
  },
};

const VERTEX_DELIVERABLES: Deliverable[] = [
  {
    id: "0222762d-e6c5-4ac3-8eef-506cff1c8678",
    name: "Partner Logo & Brand Placement",
    workstream: "Marketing & Comms",
    phase: "Onboarding",
    status: "Not started",
    dueDate: "2026-12-21",
    quantity: 1,
    notes:
      "Partner supplies logo and brand guidelines; DTM places it. Due before the graphic submission window closes, since the logo gates it.",
    events: ["SPARTA 2027"],
  },
  {
    id: "4a4fc07d-d0c6-445d-a240-4495162093f0",
    name: "Named Partner Branding Rights — SPARTA27",
    workstream: "Branding & Design",
    phase: "Fulfilment",
    status: "Not started",
    dueDate: "2027-01-04",
    quantity: 1,
    notes:
      "Contract grants prominent branding across the summit, online and on-site. Due date is the print hard wall — on-site branding cannot be added after files go to print.",
    events: ["SPARTA 2027"],
  },
];

const summaries: Record<string, PortalSummary> = {
  "nova-materials": {
    companyRecordId: "586bb3ac-517d-4757-bace-31320b63485a",
    companyName: "Nova Materials",
    slug: "nova-materials",
    variant: "dtm27",
    events: ["DTM27"],
    csStage: "Onboarded",
    onboardingStage: "Sales handover",
    health: null,
    csLeadId: "09cec7a6-eb7e-4a16-b09b-3e0abd0845a3",
    salesLeadId: "717a8af5-949d-43aa-953c-05cc40682d70",
    contractSignedDate: null,
    hasContract: false,
    invoicingStatus: "Invoiced",
    deliverablesDone: 0,
    deliverablesTotal: 0,
    overdueCount: 0,
    nextDeadline: null,
    partnerObligations: derivePartnerObligations(["DTM27"], []),
  },
  "brightline-robotics": {
    companyRecordId: "882de8c2-77cc-4fae-a7a8-3c5a96c886b5",
    companyName: "Brightline Robotics",
    slug: "brightline-robotics",
    variant: "sparta27",
    events: ["SPARTA 2027"],
    csStage: "Onboarded",
    onboardingStage: "Sales handover",
    health: null,
    csLeadId: "09cec7a6-eb7e-4a16-b09b-3e0abd0845a3",
    salesLeadId: "9c951c16-72ee-435e-9b77-c6d570dc128a",
    contractSignedDate: null,
    hasContract: true,
    invoicingStatus: "Invoiced",
    deliverablesDone: 0,
    deliverablesTotal: 0,
    overdueCount: 0,
    nextDeadline: null,
    partnerObligations: derivePartnerObligations(["SPARTA 2027"], []),
  },
  "vertex-dynamics": {
    companyRecordId: "f756a94a-44c6-40c0-abd7-4c769e6ffa6d",
    companyName: "Vertex Dynamics",
    slug: "vertex-dynamics",
    variant: "both",
    events: ["SPARTA 2027", "DTM27"],
    csStage: "Onboarded",
    onboardingStage: "Sales handover",
    health: null,
    csLeadId: "09cec7a6-eb7e-4a16-b09b-3e0abd0845a3",
    salesLeadId: "717a8af5-949d-43aa-953c-05cc40682d70",
    contractSignedDate: "2026-08-20",
    hasContract: true,
    invoicingStatus: "Invoiced",
    deliverablesDone: 0,
    deliverablesTotal: VERTEX_DELIVERABLES.length,
    overdueCount: 0,
    nextDeadline: VERTEX_DELIVERABLES.map((d) => d.dueDate)
      .filter((d): d is string => !!d)
      .sort()[0],
    partnerObligations: derivePartnerObligations(["SPARTA 2027", "DTM27"], VERTEX_DELIVERABLES),
  },
};

const details: Record<string, PortalDetail> = {
  "nova-materials": {
    ...summaries["nova-materials"],
    contractLink: null,
    poc: {
      recordId: "227a8dcf-ea84-480b-a422-baf4be323823",
      name: "Jordan Ellis",
      email: "jordan@novamaterials.example",
      jobTitle: null,
    },
    internalNotes:
      "Sample fixture: Sales Lead set to pipeline Owner; Event set from the DTM27 Partnerships pipeline.",
    deliverables: [],
  },
  "brightline-robotics": {
    ...summaries["brightline-robotics"],
    contractLink: "https://example.com/contracts/brightline-robotics.pdf",
    poc: {
      recordId: "e8cdbda6-50de-4eec-bfbf-a017c9abd0c2",
      name: "Casey Lindqvist",
      email: "casey@brightlinerobotics.example",
      jobTitle: "Senior Partner, Sector Lead",
    },
    internalNotes:
      "Sample fixture: CS entry created from the SPARTA 2027 pipeline (stage: Invoiced), which had no matching CS entry. Contracted value copied from Estimated contract value; PoC copied from Main point of contact. STILL NEEDED FROM SALES: real signed date, contracted items mapped to inventory. Deliverables not yet exploded.",
    deliverables: [],
  },
  "vertex-dynamics": {
    ...summaries["vertex-dynamics"],
    contractLink: "https://example.com/contracts/vertex-dynamics.pdf",
    poc: {
      recordId: "dade5d7f-1f6c-41da-837e-d9893d2273dd",
      name: "Morgan Feld",
      email: "morgan@vertexdynamics.example",
      jobTitle: "Chief of Staff",
    },
    internalNotes:
      'Sample fixture. EVENT: SPARTA 2027 + DTM27 — this is a SPARTA contract that also grants DTM27 tickets and a booth discount, so it spans both events.\n\nNOT YET A DELIVERABLE — NEEDS A DECISION: a standing discount right with no inventory line yet.',
    deliverables: VERTEX_DELIVERABLES,
  },
};

export async function listPortalCompanies(): Promise<PortalSummary[]> {
  return Object.values(summaries);
}

export async function getPortalBySlug(slug: string): Promise<PortalDetail | null> {
  return details[slug] ?? null;
}

export async function getStaffDirectory(): Promise<Record<string, StaffMember>> {
  return STAFF_DIRECTORY;
}

// Sanity check that fixture slugs match what slugify() would actually
// produce, so a Phase 1 bug in slug generation can't hide behind fixtures
// that were typed in by hand with the right answer already baked in.
for (const summary of Object.values(summaries)) {
  const expected = slugify(summary.companyName);
  if (expected !== summary.slug) {
    throw new Error(
      `Fixture slug mismatch for "${summary.companyName}": slugify() produces "${expected}" but the fixture says "${summary.slug}"`,
    );
  }
}
