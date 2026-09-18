"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  upsertExhibitorGuidelinesUrl,
  upsertFloorPlanUrl,
  upsertHotelBookingUrl,
  upsertPlatformUrl,
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

export async function updateGlobalPlatformUrl(formData: FormData) {
  const email = await requireStaffEmail();
  await upsertPlatformUrl("global", String(formData.get("platformUrl") ?? "").trim() || null, email);
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
