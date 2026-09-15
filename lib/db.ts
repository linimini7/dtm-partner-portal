import { Pool } from "pg";

/**
 * Singleton pool for the one thing this app's own database holds:
 * staff-editable portal content that doesn't belong in Attio (Exhibitor
 * Guidelines link, Media Kit) — see lib/portal-content.ts. Everything else
 * stays sourced live from Attio, per the original build plan.
 */
declare global {
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured.");
    }
    global.__pgPool = new Pool({ connectionString });
  }
  return global.__pgPool;
}
