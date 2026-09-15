"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { MediaKitEvent } from "@/lib/portal-content";
import { updateMediaKitCopy, updateMediaKitImage } from "@/lib/portal-content";

async function requireStaffEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");
  return session.user.email;
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
