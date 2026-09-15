/**
 * The workstream values a deliverable can carry (Attio's `workstream` select
 * field on both `deliverables` and `inventory`). `lib/portal-view.ts` groups
 * real deliverables by these values to decide what the portal UI shows —
 * new inventory items only need a `workstream` that already exists here,
 * never a code change.
 */
export type Workstream =
  | "Passes & Access"
  | "Exhibition / Booth"
  | "Content & Programming"
  | "Branding & Design"
  | "Marketing & Comms"
  | "Guardian Co-Invitation"
  | "Matchmaking / Sourcing";
