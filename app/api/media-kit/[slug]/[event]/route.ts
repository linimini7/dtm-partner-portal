import { NextResponse } from "next/server";
import { getMediaKitImage, mediaKitEventFromSlug } from "@/lib/portal-content";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; event: string }> },
) {
  const { slug, event: eventSlug } = await params;
  const event = mediaKitEventFromSlug(eventSlug);
  if (!event) {
    return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  }

  // Fall back to the global default media kit image when this partner
  // hasn't uploaded their own — matches lib/portal-content.ts's
  // getEffectiveMediaKit, which decides whether a partner's page even
  // links here in the first place.
  const image = (await getMediaKitImage(slug, event)) ?? (slug !== "global" ? await getMediaKitImage("global", event) : null);
  if (!image) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
