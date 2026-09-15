"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { upsertExhibitorGuidelinesUrl, upsertPlatformUrl } from "@/lib/portal-content";

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
