import { getPool } from "@/lib/db";
import { isNomineeObligation, isTopicObligation, type Nominee } from "@/lib/obligation-shared";

export { isNomineeObligation, isTopicObligation };
export type { Nominee };

/**
 * A partner ticking off one of their own obligations (see
 * lib/portal-view.ts's PartnerObligation) — real, persisted state, unlike
 * the staff-only Key Dates checklist which is deliberately local-only.
 * Presence of a row means checked; unchecking deletes the row rather than
 * storing a false flag.
 */

export async function getCheckedObligationIds(scope: string): Promise<Set<string>> {
  const { rows } = await getPool().query<{ obligation_id: string }>(
    "SELECT obligation_id FROM portal_obligation_checks WHERE scope = $1",
    [scope],
  );
  return new Set(rows.map((r) => r.obligation_id));
}

export async function setObligationChecked(
  scope: string,
  obligationId: string,
  checked: boolean,
  updatedBy: string,
): Promise<void> {
  if (checked) {
    await getPool().query(
      `INSERT INTO portal_obligation_checks (scope, obligation_id, checked_at, updated_by)
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (scope, obligation_id) DO UPDATE SET checked_at = now(), updated_by = EXCLUDED.updated_by`,
      [scope, obligationId, updatedBy],
    );
  } else {
    await getPool().query(
      "DELETE FROM portal_obligation_checks WHERE scope = $1 AND obligation_id = $2",
      [scope, obligationId],
    );
  }
}

/**
 * Evidence links a partner attaches to an obligation — e.g. the actual
 * LinkedIn posts and newsletter mention under "Publicly announce the
 * partnership". Independent of whether that obligation is checked; a
 * partner might list links progressively before/after ticking the box.
 * Saving replaces the whole set for that (scope, obligation) rather than
 * diffing individual adds/removes — simpler, and the editor always submits
 * its full current list anyway.
 */
export async function getObligationLinks(scope: string, obligationId: string): Promise<string[]> {
  const { rows } = await getPool().query<{ url: string }>(
    "SELECT url FROM portal_obligation_links WHERE scope = $1 AND obligation_id = $2 ORDER BY created_at, id",
    [scope, obligationId],
  );
  return rows.map((r) => r.url);
}

export async function setObligationLinks(
  scope: string,
  obligationId: string,
  urls: string[],
  updatedBy: string,
): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM portal_obligation_links WHERE scope = $1 AND obligation_id = $2", [
    scope,
    obligationId,
  ]);
  for (const url of urls) {
    await pool.query(
      `INSERT INTO portal_obligation_links (scope, obligation_id, url, created_at, updated_by)
       VALUES ($1, $2, $3, now(), $4)`,
      [scope, obligationId, url, updatedBy],
    );
  }
}

/**
 * Named nominees for a "nominate someone" obligation (Guardians, LP-GP
 * Marketplace, CXO/CVC Summit seats, investor dinner) — a partner may need
 * to name several people against one obligation, so this is a list rather
 * than a single field. Same full-replace-on-save semantics as
 * setObligationLinks.
 */
export async function getObligationNominees(scope: string, obligationId: string): Promise<Nominee[]> {
  const { rows } = await getPool().query<{ full_name: string; position: string | null; email: string | null }>(
    "SELECT full_name, position, email FROM portal_obligation_nominees WHERE scope = $1 AND obligation_id = $2 ORDER BY created_at, id",
    [scope, obligationId],
  );
  return rows.map((r) => ({ fullName: r.full_name, position: r.position ?? "", email: r.email ?? "" }));
}

export async function setObligationNominees(
  scope: string,
  obligationId: string,
  nominees: Nominee[],
  updatedBy: string,
): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM portal_obligation_nominees WHERE scope = $1 AND obligation_id = $2", [
    scope,
    obligationId,
  ]);
  for (const nominee of nominees) {
    await pool.query(
      `INSERT INTO portal_obligation_nominees (scope, obligation_id, full_name, position, email, created_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, now(), $6)`,
      [scope, obligationId, nominee.fullName, nominee.position || null, nominee.email || null, updatedBy],
    );
  }
}

/**
 * A single free-text value for a "submit your topic" obligation (a
 * speaking slot or co-curated session's working title) — unlike nominees,
 * there's only ever one topic per obligation, so this is a plain upsert
 * rather than a delete-and-reinsert list.
 */
export async function getObligationTopic(scope: string, obligationId: string): Promise<string | null> {
  const { rows } = await getPool().query<{ topic: string | null }>(
    "SELECT topic FROM portal_obligation_topics WHERE scope = $1 AND obligation_id = $2",
    [scope, obligationId],
  );
  return rows[0]?.topic ?? null;
}

export async function setObligationTopic(
  scope: string,
  obligationId: string,
  topic: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_obligation_topics (scope, obligation_id, topic, updated_at, updated_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (scope, obligation_id) DO UPDATE SET
       topic = EXCLUDED.topic,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, obligationId, topic, updatedBy],
  );
}
