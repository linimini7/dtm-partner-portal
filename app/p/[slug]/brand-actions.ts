"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { verifyPortalCode } from "@/lib/portal-code";
import {
  BRAND_LOGO_SLOTS,
  getBrandAssets,
  upsertBrandInfo,
  upsertBrandLogo,
  upsertPartnerContact,
  upsertSecondPartnerContact,
} from "@/lib/brand-assets";
import {
  setObligationChecked,
  setObligationLinks,
  setObligationNominees,
  setObligationTopic,
} from "@/lib/obligation-checks";
import type { Nominee } from "@/lib/obligation-shared";
import { extractImagesFromZip } from "@/lib/zip-images";
import { logActivity } from "@/lib/activity-log";
import { getPortalBySlug } from "@/lib/data";
import { createDraft } from "@/lib/gmail";
import { buildMoatIntroEmail, MOAT_STUDIO_CONTACTS } from "@/lib/moat-intro";

const MAX_DESCRIPTION_WORDS = 250;

/**
 * The one place a partner writes, not just reads — so unlike every other
 * server action in this app (all staff-only via `auth()`), this accepts
 * either a staff session or that partner's own portal access-code cookie.
 */
export async function requireWriteAccess(slug: string): Promise<string> {
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

export interface UpdateBrandAllResult {
  /** Set only when the .zip specifically couldn't be used — website/description/per-slot logos above still saved regardless, so this never blocks the rest of the submit. */
  zipError?: string;
}

/**
 * Everything on the brand-assets card — website, description and every
 * logo slot — saves together in one submit, so a partner changing several
 * things at once only has to click Save once.
 */
export async function updateBrandAll(formData: FormData): Promise<UpdateBrandAllResult> {
  const slug = String(formData.get("slug") ?? "");
  const updatedBy = await requireWriteAccess(slug);
  const before = await getBrandAssets(slug);

  const websiteUrl = normalizeWebsiteUrl(String(formData.get("websiteUrl") ?? ""));
  const description = clampDescription(String(formData.get("description") ?? ""));
  await upsertBrandInfo(slug, websiteUrl, description, updatedBy);

  if (websiteUrl !== before.websiteUrl) {
    await logActivity(slug, updatedBy, `Updated website URL to ${websiteUrl ?? "(removed)"}`);
  }
  if (description !== before.description) {
    await logActivity(slug, updatedBy, description ? "Updated company description" : "Removed company description");
  }

  let logosAdded = 0;
  let logosRemoved = 0;
  for (const slot of BRAND_LOGO_SLOTS) {
    const file = formData.get(`logo_${slot}`) as File | null;
    const remove = formData.get(`removeLogo_${slot}`) === "on";
    if (file && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer());
      await upsertBrandLogo(slug, slot, { bytes, mimeType: file.type }, updatedBy);
      logosAdded++;
    } else if (remove) {
      await upsertBrandLogo(slug, slot, null, updatedBy);
      logosRemoved++;
    }
  }

  // A .zip of several logos at once: extract every image inside and drop
  // each into the next open slot, in whatever order the zip lists them.
  // Extras beyond the remaining capacity are silently skipped. Parsing is
  // wrapped so a corrupted/encrypted/unreadable .zip can't take the rest of
  // this submit down with it — the website/description/per-slot logos above
  // have already been saved by this point regardless of what happens here.
  let zipError: string | undefined;
  const zipFile = formData.get("logosZip") as File | null;
  if (zipFile && zipFile.size > 0) {
    try {
      const zipBytes = Buffer.from(await zipFile.arrayBuffer());
      const images = extractImagesFromZip(zipBytes);
      if (images.length === 0) {
        zipError = "That .zip didn't have any usable images in it (png, jpg, gif, webp or svg).";
      } else {
        const current = await getBrandAssets(slug);
        const emptySlots = current.logoSlots.filter((s) => !s.hasImage).map((s) => s.slot);
        for (const { bytes, mimeType } of images) {
          const slot = emptySlots.shift();
          if (slot === undefined) break;
          await upsertBrandLogo(slug, slot, { bytes, mimeType }, updatedBy);
          logosAdded++;
        }
      }
    } catch (error) {
      console.error(`Failed to read logos .zip for ${slug}:`, error);
      zipError = "That file couldn't be read as a .zip — try re-zipping it and uploading again.";
    }
  }

  if (logosAdded > 0) {
    await logActivity(slug, updatedBy, `Uploaded ${logosAdded} logo${logosAdded === 1 ? "" : "s"}`);
  }
  if (logosRemoved > 0) {
    await logActivity(slug, updatedBy, `Removed ${logosRemoved} logo${logosRemoved === 1 ? "" : "s"}`);
  }

  revalidatePath(`/p/${slug}`);
  return { zipError };
}

/**
 * The Action Items tab's manually-checkable obligations ("Publicly announce
 * the partnership", "Nominate Guardians") — "Submit your logo" isn't here
 * since that one ticks itself from real brandAssets data (see PortalShell).
 */
/** Falls back for saveObligationLinks, which is only ever wired up for "announce" — toggleObligationChecked gets its title straight from the client instead, since obligations like the programme-seat ones are generated dynamically per partner (see lib/portal-view.ts) and can't live in a static lookup here. */
const OBLIGATION_TITLES: Record<string, string> = {
  announce: "Publicly announce the partnership",
  guardians: "Nominate Guardians for the programme",
};

export async function toggleObligationChecked(
  slug: string,
  obligationId: string,
  title: string,
  checked: boolean,
) {
  const updatedBy = await requireWriteAccess(slug);
  await setObligationChecked(slug, obligationId, checked, updatedBy);
  await logActivity(slug, updatedBy, `${checked ? "Checked" : "Unchecked"} "${title}"`);
  revalidatePath(`/p/${slug}`);
}

/**
 * The evidence links under an obligation (e.g. the actual post URLs for
 * "Publicly announce the partnership") — always replaces the full set for
 * that obligation with whatever the editor currently shows, since the UI
 * always submits its complete list rather than one link at a time.
 */
export async function saveObligationLinks(slug: string, obligationId: string, urls: string[]) {
  const updatedBy = await requireWriteAccess(slug);
  const cleaned = urls.map((u) => u.trim()).filter(Boolean);
  await setObligationLinks(slug, obligationId, cleaned, updatedBy);
  const title = OBLIGATION_TITLES[obligationId] ?? obligationId;
  await logActivity(
    slug,
    updatedBy,
    cleaned.length > 0
      ? `Saved ${cleaned.length} link${cleaned.length === 1 ? "" : "s"} for "${title}"`
      : `Cleared links for "${title}"`,
  );
  revalidatePath(`/p/${slug}`);
}

/**
 * Named attendees a partner supplies against a "nominate someone"
 * obligation (Guardians, LP-GP Marketplace, CXO/CVC Summit, investor
 * dinner) — title comes from the client since these obligations are
 * generated dynamically per partner (lib/portal-view.ts) rather than
 * living in a static lookup, same reasoning as toggleObligationChecked.
 */
export async function saveObligationNominees(
  slug: string,
  obligationId: string,
  title: string,
  nominees: Nominee[],
) {
  const updatedBy = await requireWriteAccess(slug);
  const cleaned = nominees
    .map((n) => ({ fullName: n.fullName.trim(), position: n.position.trim(), email: n.email.trim() }))
    .filter((n) => n.fullName || n.email);
  await setObligationNominees(slug, obligationId, cleaned, updatedBy);
  await logActivity(
    slug,
    updatedBy,
    cleaned.length > 0
      ? `Saved ${cleaned.length} nominee${cleaned.length === 1 ? "" : "s"} for "${title}"`
      : `Cleared nominees for "${title}"`,
  );
  revalidatePath(`/p/${slug}`);
}

/**
 * The working title a partner submits for a speaking slot or co-curated
 * session — title comes from the client for the same reason as
 * saveObligationNominees: these obligation IDs are generated dynamically
 * per partner (lib/portal-view.ts), not in a static lookup.
 */
export async function saveObligationTopic(slug: string, obligationId: string, title: string, topic: string) {
  const updatedBy = await requireWriteAccess(slug);
  const cleaned = topic.trim();
  await setObligationTopic(slug, obligationId, cleaned || null, updatedBy);
  await logActivity(slug, updatedBy, cleaned ? `Set topic for "${title}": ${cleaned}` : `Cleared topic for "${title}"`);
  revalidatePath(`/p/${slug}`);
}

/**
 * A partner proposing/updating their own point of contact from the
 * portal itself. Never overrides a staff-set Attio "poc" for display (see
 * lib/brand-assets.ts's upsertPartnerContact) — surfaced to staff via the
 * activity log instead of silently taking effect when one already exists.
 */
export async function updatePartnerContact(slug: string, name: string, email: string, phone: string) {
  const updatedBy = await requireWriteAccess(slug);
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim() || null;
  if (!trimmedEmail) throw new Error("An email address is required.");
  await upsertPartnerContact(slug, name.trim() || null, trimmedEmail, trimmedPhone, updatedBy);
  await logActivity(slug, updatedBy, `Proposed point of contact: ${name.trim() || trimmedEmail} <${trimmedEmail}>`);
  revalidatePath(`/p/${slug}`);
}

/**
 * A second, optional point of contact — some partners have one person who
 * signed the contract and a different person who's actually reachable
 * day-to-day, and want both listed. Unlike the primary contact, a blank
 * email clears this slot rather than erroring, since having none set is a
 * normal state here.
 */
export async function updateSecondPartnerContact(slug: string, name: string, email: string, phone: string) {
  const updatedBy = await requireWriteAccess(slug);
  const trimmedName = name.trim() || null;
  const trimmedEmail = email.trim() || null;
  const trimmedPhone = phone.trim() || null;
  await upsertSecondPartnerContact(slug, trimmedName, trimmedEmail, trimmedPhone, updatedBy);
  await logActivity(
    slug,
    updatedBy,
    trimmedEmail
      ? `Set an additional point of contact: ${trimmedName ?? trimmedEmail} <${trimmedEmail}>`
      : "Cleared the additional point of contact",
  );
  revalidatePath(`/p/${slug}`);
}

/**
 * A partner asking to be connected to Moat Studio (see MoatIntroForm.tsx on
 * the promo card in PortalShell.tsx) — a real form rather than a one-click
 * button specifically so a stray click can't fire an email; submitting
 * requires typing a name, email and what they actually want. Drafts the
 * intro email in the Partnerships inbox — To Moat, Cc the partner — and
 * always logs the request either way, since createDraft needs a Gmail
 * scope (gmail.compose) this app isn't authorized for yet (see
 * lib/gmail.ts) and staff still need to know a partner asked even when the
 * draft itself couldn't be created.
 */
export async function requestMoatStudioIntro(
  slug: string,
  details: { name: string; email: string; request: string; wishes: string },
): Promise<{ draftCreated: boolean }> {
  const updatedBy = await requireWriteAccess(slug);
  const portal = await getPortalBySlug(slug);
  const companyName = portal?.companyName ?? slug;
  const name = details.name.trim();
  const email = details.email.trim();
  const request = details.request.trim();
  const wishes = details.wishes.trim();
  if (!name || !email || !request) {
    throw new Error("Name, email and a description of the request are required.");
  }

  const { subject, body } = buildMoatIntroEmail({ companyName, contactName: name, contactEmail: email, request, wishes });

  let draftCreated = false;
  try {
    await createDraft({ to: MOAT_STUDIO_CONTACTS, cc: [email], subject, body });
    draftCreated = true;
  } catch (error) {
    console.error(`Failed to create Moat Studio intro draft for ${slug}:`, error);
  }

  await logActivity(
    slug,
    updatedBy,
    draftCreated
      ? `Requested an intro to Moat Studio (${name} <${email}>) — draft email created in the Partnerships inbox`
      : `Requested an intro to Moat Studio (${name} <${email}>) — couldn't auto-create the draft (Gmail isn't authorized for drafts yet); please email Moat Studio manually. Their request: "${request}"`,
  );
  revalidatePath(`/p/${slug}`);
  return { draftCreated };
}
