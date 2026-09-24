/**
 * Pulls logos and a partner point-of-contact out of real emails sent to
 * partnerships@deeptech.build, and writes them straight into the portal —
 * no staff review step (a deliberate choice, see the conversation this was
 * built in).
 *
 * Safety comes from being idempotent rather than from a moderation queue:
 * every write here only fills a gap (an empty logo slot, an unset contact)
 * and never overwrites something already on file — from a previous run, a
 * staff edit, or the partner's own upload. Logos are additionally deduped
 * by content hash (not filename or Gmail message/attachment id), so the
 * same image landing in a later scan — the same email re-processed, or a
 * partner re-sending the same file — never claims a second slot. Re-running
 * this on the same emails is always safe.
 *
 * Matching an email to a partner is by domain only: the sender's (or a
 * Cc'd address's) domain must equal one of that company's Attio Domains.
 * Emails from @deeptech.build itself are never treated as "the partner".
 * There is no per-message cursor — every run re-scans a bounded recent
 * window (see SEARCH_QUERY) and relies on the gap-filling rule above to
 * stay cheap and correct; the mailbox is small enough that this is simpler
 * and more robust than tracking state.
 */
import { getPool } from "@/lib/db";
import { listPartnerDomains } from "@/lib/attio";
import {
  getBrandAssets,
  hasFlaggedAttachment,
  hasLogoWithHash,
  hashLogoBytes,
  recordFlaggedAttachment,
  upsertBrandLogo,
} from "@/lib/brand-assets";
import { extractImagesFromZip } from "@/lib/zip-images";
import { logActivity } from "@/lib/activity-log";
import {
  flattenParts,
  getAllRecipients,
  getAttachmentBytes,
  getFrom,
  getMessage,
  isRealAttachment,
  searchMessageIds,
  type GmailMessage,
} from "@/lib/gmail";

const OWN_DOMAIN = "deeptech.build";
const SEARCH_QUERY = "has:attachment newer_than:180d";

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const ZIP_MIME_TYPES = new Set(["application/zip", "application/x-zip-compressed"]);

/**
 * .eps is a real, storable logo format now (see lib/brand-assets.ts's
 * logoFormatLabel / LogoSlotsField's "No preview" tile) — raw bytes in, no
 * rasterizing needed, so it's ingested the same as a PNG below rather than
 * flagged here. Matched by extension, not MIME type: senders' mail clients
 * often report .eps as generic application/octet-stream.
 *
 * .ai is still genuinely unsupported — nothing in this app can store or
 * display an Illustrator file usefully yet. Deliberately narrow (not every
 * non-image attachment) so a partner emailing over a signed contract PDF
 * doesn't get mistaken for a logo drop.
 */
const UNSUPPORTED_LOGO_EXTENSIONS = new Map([[".ai", "Illustrator (.ai)"]]);

const VECTOR_LOGO_EXTENSIONS = new Map([[".eps", "application/postscript"]]);

function vectorLogoMimeType(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [ext, mimeType] of VECTOR_LOGO_EXTENSIONS) {
    if (lower.endsWith(ext)) return mimeType;
  }
  return null;
}

function unsupportedLogoFormat(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [ext, label] of UNSUPPORTED_LOGO_EXTENSIONS) {
    if (lower.endsWith(ext)) return label;
  }
  return null;
}

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

interface PartnerMatch {
  slug: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string;
}

function matchPartner(
  message: GmailMessage,
  partners: { slug: string; companyName: string; domains: string[] }[],
): PartnerMatch | null {
  const candidates = [getFrom(message), ...getAllRecipients(message)].filter(
    (a): a is { name: string | null; email: string } => !!a && domainOf(a.email) !== OWN_DOMAIN,
  );
  for (const candidate of candidates) {
    const domain = domainOf(candidate.email);
    if (!domain) continue;
    const partner = partners.find((p) => p.domains.some((d) => d.toLowerCase() === domain));
    if (partner) {
      return {
        slug: partner.slug,
        companyName: partner.companyName,
        contactName: candidate.name,
        contactEmail: candidate.email,
      };
    }
  }
  return null;
}

export interface IngestionResult {
  messagesScanned: number;
  logosAdded: { slug: string; filename: string }[];
  contactsSet: { slug: string; email: string }[];
  unsupportedLogosFlagged: { slug: string; filename: string; format: string }[];
  contactMismatchesFlagged: { slug: string; email: string }[];
}

export async function ingestPartnerEmails(): Promise<IngestionResult> {
  const partners = await listPartnerDomains();
  const messageIds = await searchMessageIds(SEARCH_QUERY, 50);

  const logosAdded: IngestionResult["logosAdded"] = [];
  const contactsSet: IngestionResult["contactsSet"] = [];
  const unsupportedLogosFlagged: IngestionResult["unsupportedLogosFlagged"] = [];
  const contactMismatchesFlagged: IngestionResult["contactMismatchesFlagged"] = [];

  for (const id of messageIds) {
    const message = await getMessage(id);
    const match = matchPartner(message, partners);
    if (!match) continue;

    // ---- logos: drop any real (non-inline) image, .eps or .zip-of-images attachment into the next open slot ----
    // Excludes inline images — email-signature logos, headshots, tracking
    // pixels embedded in the body rather than deliberately attached.
    const allParts = flattenParts(message.payload.parts);
    const attachmentParts = allParts.filter(
      (p) =>
        p.filename &&
        p.mimeType &&
        IMAGE_MIME_TYPES.has(p.mimeType) &&
        p.body?.attachmentId &&
        isRealAttachment(p),
    );
    const zipParts = allParts.filter(
      (p) =>
        p.filename &&
        p.mimeType &&
        (ZIP_MIME_TYPES.has(p.mimeType) || p.filename.toLowerCase().endsWith(".zip")) &&
        p.body?.attachmentId &&
        isRealAttachment(p),
    );
    // Matched by filename, not MIME type — see vectorLogoMimeType's comment.
    const vectorParts = allParts.filter(
      (p) => p.filename && p.body?.attachmentId && isRealAttachment(p) && vectorLogoMimeType(p.filename),
    );

    if (attachmentParts.length > 0 || zipParts.length > 0 || vectorParts.length > 0) {
      const current = await getBrandAssets(match.slug);
      const emptySlots = current.logoSlots.filter((s) => !s.hasImage).map((s) => s.slot);

      // Re-scanning the same emails every run is how this stays a cursor-
      // free, idempotent pass — content hash is what actually prevents a
      // re-run from piling the same logo into a fresh slot each time.
      async function tryAddLogo(bytes: Buffer, mimeType: string, filename: string): Promise<void> {
        if (await hasLogoWithHash(match!.slug, hashLogoBytes(bytes))) return;
        const slot = emptySlots.shift();
        if (slot === undefined) return;
        await upsertBrandLogo(match!.slug, slot, { bytes, mimeType, filename }, "email-ingestion");
        logosAdded.push({ slug: match!.slug, filename });
        await logActivity(match!.slug, "email-ingestion", `Logo arrived by email (${filename})`);
      }

      for (const part of attachmentParts) {
        const bytes = await getAttachmentBytes(message.id, part.body!.attachmentId!);
        await tryAddLogo(bytes, part.mimeType!, part.filename!);
      }

      for (const part of zipParts) {
        const zipBytes = await getAttachmentBytes(message.id, part.body!.attachmentId!);
        for (const image of extractImagesFromZip(zipBytes)) {
          await tryAddLogo(image.bytes, image.mimeType, `${part.filename} → ${image.filename}`);
        }
      }

      for (const part of vectorParts) {
        const bytes = await getAttachmentBytes(message.id, part.body!.attachmentId!);
        await tryAddLogo(bytes, vectorLogoMimeType(part.filename!)!, part.filename!);
      }
    }

    // ---- unsupported vector logos (.ai): can't be ingested, but shouldn't vanish silently ----
    const unsupportedParts = allParts.filter(
      (p) => p.filename && p.body?.attachmentId && isRealAttachment(p) && unsupportedLogoFormat(p.filename),
    );
    for (const part of unsupportedParts) {
      const format = unsupportedLogoFormat(part.filename!)!;
      const bytes = await getAttachmentBytes(message.id, part.body!.attachmentId!);
      const hash = hashLogoBytes(bytes);
      if (await hasFlaggedAttachment(match.slug, hash)) continue;
      await recordFlaggedAttachment(match.slug, hash, part.filename!, format);
      unsupportedLogosFlagged.push({ slug: match.slug, filename: part.filename!, format });
      await logActivity(
        match.slug,
        "email-ingestion",
        `Logo arrived by email as a ${format} file (${part.filename}) — this format can't be auto-imported. Ask them to resend as PNG/SVG, or convert and upload it manually.`,
      );
    }

    // ---- point of contact: fill in only if we don't already have one; otherwise flag a mismatch for review ----
    const { rows } = await getPool().query<{
      partner_contact_email: string | null;
      partner_contact_2_email: string | null;
    }>("SELECT partner_contact_email, partner_contact_2_email FROM portal_content WHERE scope = $1", [
      match.slug,
    ]);
    const existingContact = rows[0]?.partner_contact_email;
    if (!existingContact) {
      await getPool().query(
        `INSERT INTO portal_content (scope, partner_contact_name, partner_contact_email, partner_contact_source, updated_at, updated_by)
         VALUES ($1, $2, $3, 'email', now(), 'email-ingestion')
         ON CONFLICT (scope) DO UPDATE SET
           partner_contact_name = EXCLUDED.partner_contact_name,
           partner_contact_email = EXCLUDED.partner_contact_email,
           partner_contact_source = EXCLUDED.partner_contact_source,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by
         WHERE portal_content.partner_contact_email IS NULL`,
        [match.slug, match.contactName, match.contactEmail],
      );
      contactsSet.push({ slug: match.slug, email: match.contactEmail });
      await logActivity(
        match.slug,
        "email-ingestion",
        `Point of contact detected from email: ${match.contactName ?? match.contactEmail} <${match.contactEmail}>`,
      );
    } else {
      // A different person than the one on file just emailed us. Reading
      // the actual message to tell a real handoff ("X is now responsible
      // for this") from a CC'd colleague or a signature mention needs
      // judgment this pipeline doesn't have — so this only ever surfaces
      // the mismatch for a human to decide, never overwrites the contact
      // (local or Attio) on its own.
      const knownEmails = new Set(
        [existingContact, rows[0]?.partner_contact_2_email].filter((e): e is string => !!e).map((e) => e.toLowerCase()),
      );
      if (!knownEmails.has(match.contactEmail.toLowerCase())) {
        const alreadyFlagged = await getPool().query(
          `SELECT 1 FROM portal_activity_log
           WHERE scope = $1 AND actor = 'email-ingestion'
             AND description LIKE '%different contact than currently on file%<' || $2 || '>%'
           LIMIT 1`,
          [match.slug, match.contactEmail],
        );
        if (alreadyFlagged.rows.length === 0) {
          contactMismatchesFlagged.push({ slug: match.slug, email: match.contactEmail });
          await logActivity(
            match.slug,
            "email-ingestion",
            `Email received from a different contact than currently on file: ${match.contactName ?? match.contactEmail} <${match.contactEmail}> (on file: ${existingContact}) — review whether the point of contact should change.`,
          );
        }
      }
    }
  }

  return { messagesScanned: messageIds.length, logosAdded, contactsSet, unsupportedLogosFlagged, contactMismatchesFlagged };
}
