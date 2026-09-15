/**
 * Pure media-kit types/helpers with no database import — kept separate from
 * lib/portal-content.ts specifically so client components (PortalShell) can
 * import them without pulling `pg` (via lib/db.ts) into the browser bundle.
 */
export type MediaKitEvent = "DTM27" | "SPARTA 2027";

export const MEDIA_KIT_EVENTS: MediaKitEvent[] = ["DTM27", "SPARTA 2027"];

export interface EventMediaKit {
  hasImage: boolean;
  copy: string | null;
}

/** URL path segment for the image-serving route — lowercase, no spaces. */
export function mediaKitEventSlug(event: MediaKitEvent): string {
  return event === "DTM27" ? "dtm27" : "sparta27";
}

export function mediaKitEventFromSlug(slug: string): MediaKitEvent | null {
  if (slug === "dtm27") return "DTM27";
  if (slug === "sparta27") return "SPARTA 2027";
  return null;
}
