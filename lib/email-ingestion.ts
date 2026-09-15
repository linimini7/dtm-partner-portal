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
import { getBrandAssets, hasLogoWithHash, hashLogoBytes, upsertBrandLogo } from "@/lib/brand-assets";
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
}

export async function ingestPartnerEmails(): Promise<IngestionResult> {
  const partners = await listPartnerDomains();
  const messageIds = await searchMessageIds(SEARCH_QUERY, 50);

  const logosAdded: IngestionResult["logosAdded"] = [];
  const contactsSet: IngestionResult["contactsSet"] = [];

  for (const id of messageIds) {
    const message = await getMessage(id);
    const match = matchPartner(message, partners);
    if (!match) continue;

    // ---- logos: drop any real (non-inline) image attachment into the next open slot ----
    // Excludes inline images — email-signature logos, headshots, tracking
    // pixels embedded in the body rather than deliberately attached.
    const attachmentParts = flattenParts(message.payload.parts).filter(
      (p) =>
        p.filename &&
        p.mimeType &&
        IMAGE_MIME_TYPES.has(p.mimeType) &&
        p.body?.attachmentId &&
        isRealAttachment(p),
    );
    if (attachmentParts.length > 0) {
      const current = await getBrandAssets(match.slug);
      const emptySlots = current.logoSlots.filter((s) => !s.hasImage).map((s) => s.slot);
      for (const part of attachmentParts) {
        const bytes = await getAttachmentBytes(message.id, part.body!.attachmentId!);
        // Re-scanning the same emails every run is how this stays a cursor-
        // free, idempotent pass — content hash is what actually prevents a
        // re-run from piling the same logo into a fresh slot each time.
        if (await hasLogoWithHash(match.slug, hashLogoBytes(bytes))) continue;
        const slot = emptySlots.shift();
        if (slot === undefined) break;
        await upsertBrandLogo(match.slug, slot, { bytes, mimeType: part.mimeType! }, "email-ingestion");
        logosAdded.push({ slug: match.slug, filename: part.filename! });
      }
    }

    // ---- point of contact: fill in only if we don't already have one ----
    const { rows } = await getPool().query<{ partner_contact_email: string | null }>(
      "SELECT partner_contact_email FROM portal_content WHERE scope = $1",
      [match.slug],
    );
    if (!rows[0]?.partner_contact_email) {
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
    }
  }

  return { messagesScanned: messageIds.length, logosAdded, contactsSet };
}
