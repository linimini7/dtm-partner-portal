import { getPool } from "@/lib/db";

/**
 * Per-partner, per-milestone work status for lib/dtm-deliverables.ts's
 * DTM_DELIVERABLES — DTM-internal only, never read by the partner-facing
 * portal (see app/p/[slug]/admin/deliverables/page.tsx). "Waiting on
 * partner" is its own state, not just "not started", because it changes who
 * needs to act next — that distinction is the whole point of the stat card
 * on the tracker page.
 */
export type DtmDeliverableStatus = "not_started" | "in_progress" | "waiting_on_partner" | "done";

export async function getDeliverableStatuses(scope: string): Promise<Record<string, DtmDeliverableStatus>> {
  const { rows } = await getPool().query<{ deliverable_id: string; status: DtmDeliverableStatus }>(
    "SELECT deliverable_id, status FROM dtm_deliverable_status WHERE scope = $1",
    [scope],
  );
  return Object.fromEntries(rows.map((r) => [r.deliverable_id, r.status]));
}

export async function setDeliverableStatus(
  scope: string,
  deliverableId: string,
  status: DtmDeliverableStatus,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO dtm_deliverable_status (scope, deliverable_id, status, updated_at, updated_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (scope, deliverable_id) DO UPDATE SET
       status = EXCLUDED.status,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, deliverableId, status, updatedBy],
  );
}
