"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  updateMediaKitCopy,
  updateMediaKitImage,
  upsertExhibitorGuidelinesUrl,
  upsertFloorPlanUrl,
  upsertHotelBookingUrl,
  type MediaKitEvent,
} from "@/lib/portal-content";
import { addDtmContact, deleteDtmContact, updateDtmContact } from "@/lib/dtm-contacts";
import type { EventName } from "@/lib/types";

async function requireStaffEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");
  return session.user.email;
}

export async function updateGlobalExhibitorGuidelines(formData: FormData) {
  const email = await requireStaffEmail();
  await upsertExhibitorGuidelinesUrl(
    "global",
    String(formData.get("exhibitorGuidelinesUrl") ?? "").trim() || null,
    email,
  );
  revalidatePath("/", "layout");
}

export async function updateGlobalHotelBookingUrl(formData: FormData) {
  const email = await requireStaffEmail();
  await upsertHotelBookingUrl("global", String(formData.get("hotelBookingUrl") ?? "").trim() || null, email);
  revalidatePath("/", "layout");
}

export async function updateGlobalFloorPlanUrl(event: EventName, formData: FormData) {
  const email = await requireStaffEmail();
  await upsertFloorPlanUrl("global", event, String(formData.get("floorPlanUrl") ?? "").trim() || null, email);
  revalidatePath("/", "layout");
}

export async function addDtmContactAction(formData: FormData) {
  const email = await requireStaffEmail();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A name is required.");
  await addDtmContact(
    {
      name,
      role: String(formData.get("role") ?? "").trim() || null,
      email: String(formData.get("contactEmail") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      status: String(formData.get("status") ?? "").trim() || null,
    },
    email,
  );
  revalidatePath("/", "layout");
}

export async function updateDtmContactAction(id: number, formData: FormData) {
  const email = await requireStaffEmail();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A name is required.");
  await updateDtmContact(
    id,
    {
      name,
      role: String(formData.get("role") ?? "").trim() || null,
      email: String(formData.get("contactEmail") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      status: String(formData.get("status") ?? "").trim() || null,
    },
    email,
  );
  revalidatePath("/", "layout");
}

export async function deleteDtmContactAction(id: number) {
  await requireStaffEmail();
  await deleteDtmContact(id);
  revalidatePath("/", "layout");
}

/**
 * The default media kit (image + copy) shown to a partner who hasn't
 * uploaded their own for this event yet — see
 * lib/portal-content.ts's getEffectiveMediaKit. A partner's own upload on
 * their /admin page always takes precedence over this once they have one.
 */
export async function updateGlobalMediaKit(event: MediaKitEvent, formData: FormData) {
  const email = await requireStaffEmail();

  const copy = String(formData.get("copy") ?? "").trim() || null;
  await updateMediaKitCopy("global", event, copy, email);

  const removeImage = formData.get("removeImage") === "on";
  const file = formData.get("image") as File | null;
  if (removeImage) {
    await updateMediaKitImage("global", event, null, email);
  } else if (file && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    await updateMediaKitImage("global", event, { bytes, mimeType: file.type || "image/png" }, email);
  }

  revalidatePath("/", "layout");
}
