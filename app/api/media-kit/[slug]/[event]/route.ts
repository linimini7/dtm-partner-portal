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

  const image = await getMediaKitImage(slug, event);
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
