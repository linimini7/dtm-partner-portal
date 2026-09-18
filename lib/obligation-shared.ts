/**
 * Pure obligation types/helpers with no server-only dependencies (unlike
 * lib/obligation-checks.ts, which pulls in the Postgres pool) — safe to
 * import from client components like PortalShell.tsx and NomineeEditor.tsx.
 */

export interface Nominee {
  fullName: string;
  position: string;
  email: string;
}

/** Obligations where a partner names real people rather than just ticking a box done. */
export function isNomineeObligation(obligationId: string): boolean {
  return obligationId === "guardians" || obligationId === "investor-dinner" || obligationId.startsWith("programme-");
}
