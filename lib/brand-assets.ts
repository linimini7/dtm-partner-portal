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
  /** `format` is a short display label ("PNG", "EPS", ...) shown in the corner of each logo tile — null only when the slot is empty. "EPS" specifically also marks a slot no browser can render inline as an `<img>`, so the UI shows a file-type tile instead of attempting a preview (see LogoSlotsField / BrandAssetsCard). */
  logoSlots: { slot: BrandLogoSlot; hasImage: boolean; format: string | null }[];
}

/**
 * Filename beats claimed mime type here — the browser's reported type for a
 * .eps file is unreliable (see lib/email-ingestion.ts's UNSUPPORTED_LOGO_EXTENSIONS,
 * which hit the same problem with real partner attachments), so this checks
 * the filename extension first and only falls back to the mime type.
 */
export function logoFormatLabel(mimeType: string | null, filename: string | null): string {
  const extMatch = filename?.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (extMatch) return extMatch[1] === "jpeg" ? "JPG" : extMatch[1].toUpperCase();
  if (mimeType === "application/postscript" || mimeType === "application/eps" || mimeType === "application/x-eps") {
    return "EPS";
  }
  const mimeMatch = mimeType?.match(/^image\/([a-z0-9+.-]+)$/);
  if (mimeMatch) {
    const sub = mimeMatch[1];
    if (sub === "jpeg") return "JPG";
    if (sub === "svg+xml") return "SVG";
    return sub.toUpperCase();
  }
  return "FILE";
}

export async function getBrandAssets(slug: string): Promise<BrandAssets> {
  const [infoResult, logoResult] = await Promise.all([
    getPool().query<{ brand_website_url: string | null; brand_description: string | null }>(
      "SELECT brand_website_url, brand_description FROM portal_content WHERE scope = $1",
      [slug],
    ),
    getPool().query<{ slot: number; mime_type: string | null; filename: string | null }>(
      "SELECT slot, mime_type, filename FROM portal_logos WHERE scope = $1",
      [slug],
    ),
  ]);
  const filledSlots = new Map(logoResult.rows.map((r) => [r.slot, r]));
  return {
    websiteUrl: infoResult.rows[0]?.brand_website_url ?? null,
    description: infoResult.rows[0]?.brand_description ?? null,
    logoSlots: BRAND_LOGO_SLOTS.map((slot) => {
      const row = filledSlots.get(slot);
      return { slot, hasImage: !!row, format: row ? logoFormatLabel(row.mime_type, row.filename) : null };
    }),
  };
}

export interface EmailDerivedContact {
  name: string | null;
  email: string;
  /** For quick reach — set by either side via PartnerContactsCard, independent of whether the name/email above came from Attio's "poc" or email-ingestion (unlike those, Attio has no field this reads from). */
  phone: string | null;
}

/** The partner contact lib/email-ingestion.ts picked up from a real email — only present when nobody has set a "poc" on the Attio CS Tracker entry yet (see admin/page.tsx, which prefers that over this). */
export async function getEmailDerivedContact(slug: string): Promise<EmailDerivedContact | null> {
  const { rows } = await getPool().query<{
    partner_contact_name: string | null;
    partner_contact_email: string | null;
    partner_contact_phone: string | null;
  }>(
    "SELECT partner_contact_name, partner_contact_email, partner_contact_phone FROM portal_content WHERE scope = $1",
    [slug],
  );
  const email = rows[0]?.partner_contact_email;
  if (!email) return null;
  return { name: rows[0]?.partner_contact_name ?? null, email, phone: rows[0]?.partner_contact_phone ?? null };
}

/** Just the phone number, for when the displayed name/email came from Attio's "poc" instead (see app/p/[slug]/page.tsx) — phone has no Attio equivalent, so it's always sourced from here regardless. */
export async function getPartnerContactPhone(slug: string): Promise<string | null> {
  const { rows } = await getPool().query<{ partner_contact_phone: string | null }>(
    "SELECT partner_contact_phone FROM portal_content WHERE scope = $1",
    [slug],
  );
  return rows[0]?.partner_contact_phone ?? null;
}

/**
 * A partner proposing/updating their own point of contact directly (as
 * opposed to lib/email-ingestion.ts inferring one from a real email).
 * Writes the same partner_contact_* columns getEmailDerivedContact reads —
 * an Attio-set "poc" still takes precedence for display wherever that's
 * checked (see app/p/[slug]/page.tsx and admin/page.tsx), so this only
 * actually changes what's shown when no staff-set contact exists yet;
 * otherwise it's a proposal staff see via the activity log without it
 * silently overriding what they set in Attio. Phone is the exception: it has
 * no Attio field to defer to, so it always takes effect (see getPartnerContactPhone).
 */
export async function upsertPartnerContact(
  scope: string,
  name: string | null,
  email: string,
  phone: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_content (scope, partner_contact_name, partner_contact_email, partner_contact_phone, partner_contact_source, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, 'partner', now(), $5)
     ON CONFLICT (scope) DO UPDATE SET
       partner_contact_name = EXCLUDED.partner_contact_name,
       partner_contact_email = EXCLUDED.partner_contact_email,
       partner_contact_phone = EXCLUDED.partner_contact_phone,
       partner_contact_source = EXCLUDED.partner_contact_source,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, name, email, phone, updatedBy],
  );
}

export interface EmailDerivedContact2 {
  name: string | null;
  email: string;
  phone: string | null;
}

/** A second, partner-nominated point of contact — for when one person signs/receives but someone else should also be reachable. Portal-local only (no Attio equivalent field), so unlike the primary contact there's no "staff already set this in Attio" precedence to defer to. */
export async function getSecondPartnerContact(slug: string): Promise<EmailDerivedContact2 | null> {
  const { rows } = await getPool().query<{
    partner_contact_2_name: string | null;
    partner_contact_2_email: string | null;
    partner_contact_2_phone: string | null;
  }>(
    "SELECT partner_contact_2_name, partner_contact_2_email, partner_contact_2_phone FROM portal_content WHERE scope = $1",
    [slug],
  );
  const email = rows[0]?.partner_contact_2_email;
  if (!email) return null;
  return {
    name: rows[0]?.partner_contact_2_name ?? null,
    email,
    phone: rows[0]?.partner_contact_2_phone ?? null,
  };
}

/** Unlike upsertPartnerContact, an empty email clears this slot rather than erroring — a second contact is optional by nature. */
export async function upsertSecondPartnerContact(
  scope: string,
  name: string | null,
  email: string | null,
  phone: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_content (scope, partner_contact_2_name, partner_contact_2_email, partner_contact_2_phone, partner_contact_2_source, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, 'partner', now(), $5)
     ON CONFLICT (scope) DO UPDATE SET
       partner_contact_2_name = EXCLUDED.partner_contact_2_name,
       partner_contact_2_email = EXCLUDED.partner_contact_2_email,
       partner_contact_2_phone = EXCLUDED.partner_contact_2_phone,
       partner_contact_2_source = EXCLUDED.partner_contact_2_source,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, name, email, phone, updatedBy],
  );
}

/** Whether this exact attachment (by content hash) has already been flagged as an unsupported logo format for this partner — keeps lib/email-ingestion.ts's daily re-scan from re-logging the same .eps file every single day. */
export async function hasFlaggedAttachment(scope: string, contentHash: string): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT 1 FROM portal_flagged_attachments WHERE scope = $1 AND content_hash = $2 LIMIT 1",
    [scope, contentHash],
  );
  return rows.length > 0;
}

export async function recordFlaggedAttachment(
  scope: string,
  contentHash: string,
  filename: string,
  format: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_flagged_attachments (scope, content_hash, filename, format, created_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (scope, content_hash) DO NOTHING`,
    [scope, contentHash, filename, format],
  );
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
): Promise<{ bytes: Buffer; mimeType: string; filename: string | null } | null> {
  const { rows } = await getPool().query<{ bytes: Buffer; mime_type: string; filename: string | null }>(
    "SELECT bytes, mime_type, filename FROM portal_logos WHERE scope = $1 AND slot = $2",
    [scope, slot],
  );
  const row = rows[0];
  return row ? { bytes: row.bytes, mimeType: row.mime_type, filename: row.filename } : null;
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
  image: { bytes: Buffer; mimeType: string; filename?: string | null } | null,
  updatedBy: string,
): Promise<void> {
  if (!image) {
    await getPool().query("DELETE FROM portal_logos WHERE scope = $1 AND slot = $2", [scope, slot]);
    return;
  }
  const contentHash = hashLogoBytes(image.bytes);
  await getPool().query(
    `INSERT INTO portal_logos (scope, slot, bytes, mime_type, filename, content_hash, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
     ON CONFLICT (scope, slot) DO UPDATE SET
       bytes = EXCLUDED.bytes,
       mime_type = EXCLUDED.mime_type,
       filename = EXCLUDED.filename,
       content_hash = EXCLUDED.content_hash,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, slot, image.bytes, image.mimeType, image.filename ?? null, contentHash, updatedBy],
  );
}
