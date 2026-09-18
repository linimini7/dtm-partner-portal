import { getPool } from "@/lib/db";

/**
 * A running log of partner-initiated changes, surfaced to staff on
 * /portals — direct answer to "when a partner changes something, we see it
 * somehow" without needing an email-sending integration (the Gmail
 * credentials configured for this app are read-only; sending would need a
 * separate OAuth consent with a broader scope). `actor` is whatever
 * requireWriteAccess returned (a staff email, or `partner:{slug}`), so it's
 * always clear whether a change came from the partner or from staff editing
 * on their behalf.
 */

export interface ActivityLogEntry {
  id: number;
  scope: string;
  actor: string;
  description: string;
  createdAt: string;
}

export async function logActivity(scope: string, actor: string, description: string): Promise<void> {
  await getPool().query(
    "INSERT INTO portal_activity_log (scope, actor, description, created_at) VALUES ($1, $2, $3, now())",
    [scope, actor, description],
  );
}

export async function getRecentActivity(limit = 30): Promise<ActivityLogEntry[]> {
  const { rows } = await getPool().query<{
    id: number;
    scope: string;
    actor: string;
    description: string;
    created_at: string;
  }>("SELECT id, scope, actor, description, created_at FROM portal_activity_log ORDER BY created_at DESC LIMIT $1", [
    limit,
  ]);
  return rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    actor: r.actor,
    description: r.description,
    createdAt: r.created_at,
  }));
}
