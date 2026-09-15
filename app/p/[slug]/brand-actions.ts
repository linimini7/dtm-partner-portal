"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { verifyPortalCode } from "@/lib/portal-code";
import { BRAND_LOGO_SLOTS, getBrandAssets, upsertBrandInfo, upsertBrandLogo } from "@/lib/brand-assets";

const MAX_DESCRIPTION_WORDS = 250;

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * The one place a partner writes, not just reads — so unlike every other
 * server action in this app (all staff-only via `auth()`), this accepts
 * either a staff session or that partner's own portal access-code cookie.
 */
async function requireWriteAccess(slug: string): Promise<string> {
  const session = await auth();
  if (session?.user?.email) return session.user.email;

  const cookieStore = await cookies();
  const submittedCode = cookieStore.get(`pa_${slug}`)?.value;
  if (submittedCode && verifyPortalCode(slug, submittedCode)) {
    return `partner:${slug}`;
  }
  throw new Error("Not authorized to edit this portal.");
}

function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function clampDescription(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  return words.length > MAX_DESCRIPTION_WORDS
    ? words.slice(0, MAX_DESCRIPTION_WORDS).join(" ")
    : trimmed;
}

/**
 * Everything on the brand-assets card — website, description and every
 * logo slot — saves together in one submit, so a partner changing several
 * things at once only has to click Save once.
 */
export async function updateBrandAll(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const updatedBy = await requireWriteAccess(slug);

  const websiteUrl = normalizeWebsiteUrl(String(formData.get("websiteUrl") ?? ""));
  const description = clampDescription(String(formData.get("description") ?? ""));
  await upsertBrandInfo(slug, websiteUrl, description, updatedBy);

  for (const slot of BRAND_LOGO_SLOTS) {
    const file = formData.get(`logo_${slot}`) as File | null;
    const remove = formData.get(`removeLogo_${slot}`) === "on";
    if (file && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer());
      await upsertBrandLogo(slug, slot, { bytes, mimeType: file.type }, updatedBy);
    } else if (remove) {
      await upsertBrandLogo(slug, slot, null, updatedBy);
    }
  }

  // A .zip of several logos at once: extract every image inside and drop
  // each into the next open slot, in whatever order the zip lists them.
  // Extras beyond the remaining capacity are silently skipped rather than
  // erroring — there is no form field to report that back through.
  const zipFile = formData.get("logosZip") as File | null;
  if (zipFile && zipFile.size > 0) {
    const zipBytes = Buffer.from(await zipFile.arrayBuffer());
    const zip = new AdmZip(zipBytes);
    const imageEntries: { entry: AdmZip.IZipEntry; mimeType: string }[] = [];
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || entry.entryName.split("/").pop()?.startsWith(".")) continue;
      const extension = entry.entryName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
      const mimeType = IMAGE_MIME_BY_EXTENSION[extension];
      if (mimeType) imageEntries.push({ entry, mimeType });
    }

    const current = await getBrandAssets(slug);
    const emptySlots = current.logoSlots.filter((s) => !s.hasImage).map((s) => s.slot);

    for (const { entry, mimeType } of imageEntries) {
      const slot = emptySlots.shift();
      if (slot === undefined) break;
      await upsertBrandLogo(slug, slot, { bytes: entry.getData(), mimeType }, updatedBy);
    }
  }

  revalidatePath(`/p/${slug}`);
}
