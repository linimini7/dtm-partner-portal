import { getPool } from "@/lib/db";

/**
 * Redemption codes for a partner's included tickets — staff-only, set on
 * that partner's own /admin page. Keyed by the Attio deliverable id rather
 * than one code per partner, since a partner can hold several distinct
 * ticket types (e.g. DTM27 General Admission and SPARTA27 Partner) that
 * each need their own code.
 */

export async function getTicketCodes(scope: string): Promise<Record<string, string>> {
  const { rows } = await getPool().query<{ deliverable_id: string; code: string }>(
    "SELECT deliverable_id, code FROM portal_ticket_codes WHERE scope = $1",
    [scope],
  );
  return Object.fromEntries(rows.map((r) => [r.deliverable_id, r.code]));
}

export async function upsertTicketCode(
  scope: string,
  deliverableId: string,
  code: string | null,
  updatedBy: string,
): Promise<void> {
  const trimmed = code?.trim();
  if (!trimmed) {
    await getPool().query(
      "DELETE FROM portal_ticket_codes WHERE scope = $1 AND deliverable_id = $2",
      [scope, deliverableId],
    );
    return;
  }
  await getPool().query(
    `INSERT INTO portal_ticket_codes (scope, deliverable_id, code, updated_at, updated_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (scope, deliverable_id) DO UPDATE SET
       code = EXCLUDED.code,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, deliverableId, trimmed, updatedBy],
  );
}
