"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { MediaKitEvent } from "@/lib/portal-content";
import { updateMediaKitCopy, updateMediaKitImage } from "@/lib/portal-content";
import { upsertTicketCode } from "@/lib/ticket-codes";
import { logActivity } from "@/lib/activity-log";

async function requireStaffEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");
  return session.user.email;
}

/**
 * One redemption code per ticket deliverable, all saved in one submit —
 * fields are named `code_{deliverableId}`.
 */
export async function updateTicketCodes(slug: string, deliverableIds: string[], formData: FormData) {
  const email = await requireStaffEmail();
  let changed = 0;
  for (const deliverableId of deliverableIds) {
    const value = String(formData.get(`code_${deliverableId}`) ?? "").trim() || null;
    await upsertTicketCode(slug, deliverableId, value, email);
    changed++;
  }
  if (changed > 0) {
    await logActivity(slug, email, "Updated ticket redemption code(s)");
  }
  revalidatePath(`/p/${slug}`);
  revalidatePath(`/p/${slug}/admin`);
}

export async function updatePartnerMediaKit(slug: string, event: MediaKitEvent, formData: FormData) {
  const email = await requireStaffEmail();

  const copy = String(formData.get("copy") ?? "").trim() || null;
  await updateMediaKitCopy(slug, event, copy, email);

  const removeImage = formData.get("removeImage") === "on";
  const file = formData.get("image") as File | null;
  if (removeImage) {
    await updateMediaKitImage(slug, event, null, email);
  } else if (file && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    await updateMediaKitImage(slug, event, { bytes, mimeType: file.type || "image/png" }, email);
  }

  revalidatePath(`/p/${slug}`);
  revalidatePath(`/p/${slug}/admin`);
}
