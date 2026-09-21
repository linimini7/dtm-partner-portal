import { getPool } from "@/lib/db";
import { MEDIA_KIT_EVENTS, type EventMediaKit, type MediaKitEvent } from "@/lib/media-kit";
import type { EventName } from "@/lib/types";

// Re-exported so existing server-only importers (route handler, admin pages)
// don't need a second import line — client components must import these
// from lib/media-kit.ts directly, never from here (see that file's comment).
export {
  MEDIA_KIT_EVENTS,
  mediaKitEventSlug,
  mediaKitEventFromSlug,
  type MediaKitEvent,
  type EventMediaKit,
} from "@/lib/media-kit";

/**
 * Staff-editable content that has no home in Attio.
 *
 * Exhibitor Guidelines: a single URL, editable globally (applies to every
 * partner) or per-partner (overrides just one company) — a per-partner value
 * of null/blank means "inherit the global default".
 *
 * Media kit: a LinkedIn-ready image plus ready-to-post copy, one pair per
 * event (DTM27 / SPARTA27), scoped to one partner (slug) — each company gets
 * its own image and copy, edited on that company's own /p/[slug]/admin page.
 * There is no global default and no fallback: an empty pair just means
 * nothing has been uploaded for that partner yet. Uploaded images are stored
 * as bytea and served through /api/media-kit/[slug]/[event], never inlined
 * into the page itself.
 */
function mediaKitColumn(event: MediaKitEvent): string {
  return event === "DTM27" ? "dtm27" : "sparta27";
}

/** Same DTM27/SPARTA27 column-naming scheme as media kit — floor plans only ever exist for the two current-cycle events. */
function floorPlanColumn(event: EventName): string {
  return `floor_plan_${event === "DTM27" ? "dtm27" : "sparta27"}_url`;
}

export interface PortalContentFields {
  exhibitorGuidelinesUrl: string | null;
  platformUrl: string | null;
  /** "Coming your way" → Quick Links → Hotel booking. Global-only, same one link for every partner and every event — see the settings page copy. */
  hotelBookingUrl: string | null;
  /** Floor plan link per event, keyed by EventName — global-only, staff-set on Global portal settings. */
  floorPlanUrls: Partial<Record<EventName, string>>;
}

interface ExhibitorRow {
  exhibitor_guidelines_url: string | null;
  platform_url: string | null;
  hotel_booking_url: string | null;
  floor_plan_dtm27_url: string | null;
  floor_plan_sparta27_url: string | null;
}

function rowToFields(row: ExhibitorRow | undefined): PortalContentFields {
  const floorPlanUrls: Partial<Record<EventName, string>> = {};
  if (row?.floor_plan_dtm27_url) floorPlanUrls.DTM27 = row.floor_plan_dtm27_url;
  if (row?.floor_plan_sparta27_url) floorPlanUrls["SPARTA 2027"] = row.floor_plan_sparta27_url;
  return {
    exhibitorGuidelinesUrl: row?.exhibitor_guidelines_url ?? null,
    platformUrl: row?.platform_url ?? null,
    hotelBookingUrl: row?.hotel_booking_url ?? null,
    floorPlanUrls,
  };
}

/** The raw stored links for one scope ('global' or a slug) — used by admin forms so staff can see exactly what's overridden vs inherited. */
export async function getRawPortalContent(scope: string): Promise<PortalContentFields> {
  const { rows } = await getPool().query<ExhibitorRow>(
    `SELECT exhibitor_guidelines_url, platform_url, hotel_booking_url,
            floor_plan_dtm27_url, floor_plan_sparta27_url
     FROM portal_content WHERE scope = $1`,
    [scope],
  );
  return rowToFields(rows[0]);
}

/** What a given portal should actually show: per-slug override, falling back to the global default. Hotel booking and floor plans are global-only (same as platformUrl), but this keeps the same merge shape as exhibitorGuidelinesUrl in case that changes. */
export async function getEffectivePortalContent(slug: string): Promise<PortalContentFields> {
  const { rows } = await getPool().query<ExhibitorRow & { scope: string }>(
    `SELECT scope, exhibitor_guidelines_url, platform_url, hotel_booking_url,
            floor_plan_dtm27_url, floor_plan_sparta27_url
     FROM portal_content WHERE scope = $1 OR scope = 'global'`,
    [slug],
  );
  const global = rowToFields(rows.find((r) => r.scope === "global"));
  const override = rowToFields(rows.find((r) => r.scope === slug));
  return {
    exhibitorGuidelinesUrl: override.exhibitorGuidelinesUrl ?? global.exhibitorGuidelinesUrl,
    platformUrl: override.platformUrl ?? global.platformUrl,
    hotelBookingUrl: override.hotelBookingUrl ?? global.hotelBookingUrl,
    floorPlanUrls: Object.keys(override.floorPlanUrls).length > 0 ? override.floorPlanUrls : global.floorPlanUrls,
  };
}

export async function upsertExhibitorGuidelinesUrl(
  scope: string,
  url: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_content (scope, exhibitor_guidelines_url, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (scope) DO UPDATE SET
       exhibitor_guidelines_url = EXCLUDED.exhibitor_guidelines_url,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, url, updatedBy],
  );
}

export async function upsertPlatformUrl(
  scope: string,
  url: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_content (scope, platform_url, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (scope) DO UPDATE SET
       platform_url = EXCLUDED.platform_url,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, url, updatedBy],
  );
}

export async function upsertHotelBookingUrl(
  scope: string,
  url: string | null,
  updatedBy: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO portal_content (scope, hotel_booking_url, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (scope) DO UPDATE SET
       hotel_booking_url = EXCLUDED.hotel_booking_url,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, url, updatedBy],
  );
}

export async function upsertFloorPlanUrl(
  scope: string,
  event: EventName,
  url: string | null,
  updatedBy: string,
): Promise<void> {
  const col = floorPlanColumn(event);
  await getPool().query(
    `INSERT INTO portal_content (scope, ${col}, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (scope) DO UPDATE SET
       ${col} = EXCLUDED.${col},
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [scope, url, updatedBy],
  );
}

/** One partner's media kit (image presence + copy) for every current-cycle event — what that partner actually sees. */
export async function getMediaKit(slug: string): Promise<Record<MediaKitEvent, EventMediaKit>> {
  const { rows } = await getPool().query<{
    has_image_dtm27: boolean;
    media_kit_copy_dtm27: string | null;
    has_image_sparta27: boolean;
    media_kit_copy_sparta27: string | null;
  }>(
    `SELECT
       (media_kit_image_dtm27 IS NOT NULL) AS has_image_dtm27,
       media_kit_copy_dtm27,
       (media_kit_image_sparta27 IS NOT NULL) AS has_image_sparta27,
       media_kit_copy_sparta27
     FROM portal_content WHERE scope = $1`,
    [slug],
  );
  const row = rows[0];
  return {
    DTM27: { hasImage: row?.has_image_dtm27 ?? false, copy: row?.media_kit_copy_dtm27 ?? null },
    "SPARTA 2027": {
      hasImage: row?.has_image_sparta27 ?? false,
      copy: row?.media_kit_copy_sparta27 ?? null,
    },
  };
}

/**
 * What a partner actually sees for their media kit: their own upload for an
 * event if they have one, otherwise the global default set on Global portal
 * settings (see upsertGlobal media kit actions) — same override-falls-back-
 * to-default shape as getEffectivePortalContent. Falls back per event as a
 * whole record (image+copy together), not mixing a partner's own image with
 * the global copy or vice versa, so a partner never sees an accidental
 * mismatched pairing.
 */
export async function getEffectiveMediaKit(slug: string): Promise<Record<MediaKitEvent, EventMediaKit>> {
  const [own, global] = await Promise.all([getMediaKit(slug), getMediaKit("global")]);
  const effective = {} as Record<MediaKitEvent, EventMediaKit>;
  for (const event of MEDIA_KIT_EVENTS) {
    const ownKit = own[event];
    effective[event] = ownKit.hasImage || ownKit.copy ? ownKit : global[event];
  }
  return effective;
}

/** The raw image bytes for one partner's media kit for one event, for the /api/media-kit/[slug]/[event] route. */
export async function getMediaKitImage(
  slug: string,
  event: MediaKitEvent,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const col = mediaKitColumn(event);
  const { rows } = await getPool().query<Record<string, Buffer | string | null>>(
    `SELECT media_kit_image_${col} AS bytes, media_kit_image_${col}_type AS mime_type
     FROM portal_content WHERE scope = $1`,
    [slug],
  );
  const row = rows[0];
  const bytes = row?.bytes as Buffer | null;
  const mimeType = row?.mime_type as string | null;
  if (!bytes || !mimeType) return null;
  return { bytes, mimeType };
}

export async function updateMediaKitCopy(
  slug: string,
  event: MediaKitEvent,
  copy: string | null,
  updatedBy: string,
): Promise<void> {
  const col = `media_kit_copy_${mediaKitColumn(event)}`;
  await getPool().query(
    `INSERT INTO portal_content (scope, ${col}, updated_at, updated_by)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (scope) DO UPDATE SET
       ${col} = EXCLUDED.${col},
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [slug, copy, updatedBy],
  );
}

export async function updateMediaKitImage(
  slug: string,
  event: MediaKitEvent,
  image: { bytes: Buffer; mimeType: string } | null,
  updatedBy: string,
): Promise<void> {
  const imageCol = `media_kit_image_${mediaKitColumn(event)}`;
  const typeCol = `${imageCol}_type`;
  await getPool().query(
    `INSERT INTO portal_content (scope, ${imageCol}, ${typeCol}, updated_at, updated_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (scope) DO UPDATE SET
       ${imageCol} = EXCLUDED.${imageCol},
       ${typeCol} = EXCLUDED.${typeCol},
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [slug, image?.bytes ?? null, image?.mimeType ?? null, updatedBy],
  );
}
