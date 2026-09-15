import { createHash } from "crypto";
import { getPool } from "@/lib/db";

/**
 * "What we need from you": a per-partner website URL, a short description
 * and up to MAX_LOGO_SLOTS logo images — the one place in the app a partner
 * can write, not just read. Either the partner (via their portal access
 * code) or DTM staff can fill this in, and either side's edit goes live
 * immediately, no approval step. Logos live in their own table (not more
 * BYTEA columns on portal_content) since a partner can have many of them.
 */

export const MAX_LOGO_SLOTS = 20;
export const BRAND_LOGO_SLOTS = Array.from({ length: MAX_LOGO_SLOTS }, (_, i) => i + 1);
export type BrandLogoSlot = number;

export interface BrandAssets {
  websiteUrl: string | null;
  description: string | null;
  logoSlots: { slot: BrandLogoSlot; hasImage: boolean }[];
}

export async function getBrandAssets(slug: string): Promise<BrandAssets> {
  const [infoResult, logoResult] = await Promise.all([
    getPool().query<{ brand_website_url: string | null; brand_description: string | null }>(
      "SELECT brand_website_url, brand_description FROM portal_content WHERE scope = $1",
      [slug],
    ),
    getPool().query<{ slot: number }>("SELECT slot FROM portal_logos WHERE scope = $1", [slug]),
  ]);
  const filledSlots = new Set(logoResult.rows.map((r) => r.slot));
  return {
    websiteUrl: infoResult.rows[0]?.brand_website_url ?? null,
    description: infoResult.rows[0]?.brand_description ?? null,
    logoSlots: BRAND_LOGO_SLOTS.map((slot) => ({ slot, hasImage: filledSlots.has(slot) })),
  };
}

export interface EmailDerivedContact {
  name: string | null;
  email: string;
}

/** The partner contact lib/email-ingestion.ts picked up from a real email — only present when nobody has set a "poc" on the Attio CS Tracker entry yet (see admin/page.tsx, which prefers that over this). */
export async function getEmailDerivedContact(slug: string): Promise<EmailDerivedContact | null> {
  const { rows } = await getPool().query<{
    partner_contact_name: string | null;
    partner_contact_email: string | null;
  }>("SELECT partner_contact_name, partner_contact_email FROM portal_content WHERE scope = $1", [slug]);
  const email = rows[0]?.partner_contact_email;
  if (!email) return null;
  return { name: rows[0]?.partner_contact_name ?? null, email };
}

export async function upsertBrandInfo(
  scope: string,
  websiteUrl: string | null,
  description: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_content (scope, brand_website_url, brand_description, updated_at, updated_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (scope) DO UPDATE SET
       brand_website_url = EXCLUDED.brand_website_url,
       brand_description = EXCLUDED.brand_description,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, websiteUrl, description, updatedBy],
  );
}

export async function getBrandLogo(
  scope: string,
  slot: number,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const { rows } = await getPool().query<{ bytes: Buffer; mime_type: string }>(
    "SELECT bytes, mime_type FROM portal_logos WHERE scope = $1 AND slot = $2",
    [scope, slot],
  );
  const row = rows[0];
  return row ? { bytes: row.bytes, mimeType: row.mime_type } : null;
}

export function hashLogoBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Whether this exact image (by content, not filename) is already saved somewhere for this partner — lets lib/email-ingestion.ts re-scan the same emails on every run without ever duplicating a logo into a second slot. */
export async function hasLogoWithHash(scope: string, contentHash: string): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT 1 FROM portal_logos WHERE scope = $1 AND content_hash = $2 LIMIT 1",
    [scope, contentHash],
  );
  return rows.length > 0;
}

export async function upsertBrandLogo(
  scope: string,
  slot: number,
  image: { bytes: Buffer; mimeType: string } | null,
  updatedBy: string,
): Promise<void> {
  if (!image) {
    await getPool().query("DELETE FROM portal_logos WHERE scope = $1 AND slot = $2", [scope, slot]);
    return;
  }
  const contentHash = hashLogoBytes(image.bytes);
  await getPool().query(
    `INSERT INTO portal_logos (scope, slot, bytes, mime_type, content_hash, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, now(), $6)
     ON CONFLICT (scope, slot) DO UPDATE SET
       bytes = EXCLUDED.bytes,
       mime_type = EXCLUDED.mime_type,
       content_hash = EXCLUDED.content_hash,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, slot, image.bytes, image.mimeType, contentHash, updatedBy],
  );
}
