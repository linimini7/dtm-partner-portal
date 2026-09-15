import { NextResponse } from "next/server";
import { getBrandLogo, MAX_LOGO_SLOTS } from "@/lib/brand-assets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; slot: string }> },
) {
  const { slug, slot } = await params;
  const slotNumber = Number(slot);
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > MAX_LOGO_SLOTS) {
    return NextResponse.json({ error: "Unknown slot" }, { status: 404 });
  }

  const logo = await getBrandLogo(slug, slotNumber);
  if (!logo) {
    return NextResponse.json({ error: "No logo uploaded" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
