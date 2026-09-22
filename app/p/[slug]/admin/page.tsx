import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPortalBySlug } from "@/lib/data";
import { getEffectivePortalContent, getMediaKit, mediaKitEventSlug, type MediaKitEvent } from "@/lib/portal-content";
import { getEmailDerivedContact, getPartnerContactPhone } from "@/lib/brand-assets";
import { getPortalCode } from "@/lib/portal-code";
import { getTicketCodes } from "@/lib/ticket-codes";
import { buildPortalView } from "@/lib/portal-view";
import { updatePartnerMediaKit, updateTicketCodes } from "./actions";
import ImageDropField from "../ImageDropField";
import SaveMediaKitButton from "./SaveMediaKitButton";

export default async function PortalAdminPage({ params }: PageProps<"/p/[slug]/admin">) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { slug } = await params;
  const portal = await getPortalBySlug(slug);
  if (!portal) notFound();

  const code = getPortalCode(slug);
  const mediaKit = await getMediaKit(slug);
  const emailContact = portal.poc ? null : await getEmailDerivedContact(slug);
  const contactPhone = await getPartnerContactPhone(slug);
  const mediaKitEvents = portal.events.filter(
    (e): e is MediaKitEvent => e === "DTM27" || e === "SPARTA 2027",
  );
  const portalContent = await getEffectivePortalContent(slug);
  const view = buildPortalView(portal, portalContent);
  const ticketCodes = await getTicketCodes(slug);
  const ticketDeliverableIds = view.ticketItems.map((d) => d.id);
  const updateTicketCodesAction = updateTicketCodes.bind(null, slug, ticketDeliverableIds);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <Link href="/portals" className="text-sm">
          ← All portals
        </Link>
        <h1 className="mt-2 text-2xl text-fg-1">{portal.companyName} — admin</h1>
        <div className="flex gap-4">
          <Link href={`/p/${slug}`} className="text-sm">
            View the partner-facing portal ↗
          </Link>
          <Link href={`/p/${slug}/admin/deliverables`} className="text-sm">
            DTM deliverable tracker (internal) →
          </Link>
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">Partner access code</p>
        <p className="mb-2 font-mono text-2xl" style={{ color: "var(--accent)" }}>
          {code}
        </p>
        <p className="text-sm text-fg-4">
          Send this to the partner&apos;s point of contact — entering it at{" "}
          <code>/p/{slug}</code> unlocks their portal with no account needed. It never expires
          or rotates unless <code>PORTAL_CODE_SECRET</code> changes.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">Ticket redemption codes</p>
        {view.ticketItems.length === 0 ? (
          <p className="text-sm text-fg-4">No ticket deliverables recorded for this partner yet.</p>
        ) : (
          <form action={updateTicketCodesAction} className="flex flex-col gap-4">
            {view.ticketItems.map((d) => (
              <label key={d.id} className="block text-sm">
                <span className="mb-1 block text-fg-3">
                  {d.name}
                  {d.quantity && d.quantity > 1 ? ` (× ${d.quantity})` : ""}
                </span>
                <input
                  type="text"
                  name={`code_${d.id}`}
                  defaultValue={ticketCodes[d.id] ?? ""}
                  placeholder="e.g. DTM27-VUSE-XR"
                  className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 font-mono text-fg-1"
                />
              </label>
            ))}
            <button
              type="submit"
              className="self-start rounded-[8px] px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
            >
              Save redemption codes
            </button>
          </form>
        )}
        <p className="mt-3 text-xs text-fg-5">
          Each ticket type gets its own code — the partner sees it under &quot;Redeem your
          included tickets.&quot;
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">Partner&apos;s point of contact</p>
        {portal.poc ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-[15px] text-fg-1">{portal.poc.name}</p>
            {portal.poc.jobTitle && <p className="text-sm text-fg-4">{portal.poc.jobTitle}</p>}
            {portal.poc.email && (
              <a href={`mailto:${portal.poc.email}`} className="text-sm">
                {portal.poc.email}
              </a>
            )}
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className="text-sm">
                {contactPhone}
              </a>
            )}
          </div>
        ) : emailContact ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-[15px] text-fg-1">{emailContact.name ?? emailContact.email}</p>
            <a href={`mailto:${emailContact.email}`} className="text-sm">
              {emailContact.email}
            </a>
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className="text-sm">
                {contactPhone}
              </a>
            )}
            <p className="mt-1 text-xs text-fg-5">
              Picked up automatically from an email — not set on Attio&apos;s CS Tracker entry.
            </p>
          </div>
        ) : (
          <p className="text-sm text-fg-4">
            No PoC set on the CS Tracker entry yet — set the &quot;PoC&quot; field on this
            company&apos;s CS Tracker entry in Attio.
          </p>
        )}
        {!contactPhone && (portal.poc || emailContact) && (
          <p className="mt-2 text-xs text-fg-5">
            No phone on file — the partner (or you, on their portal) can add one under
            &quot;Point of contact.&quot;
          </p>
        )}
      </div>

      {mediaKitEvents.map((event) => {
        const kit = mediaKit[event];
        const updateAction = updatePartnerMediaKit.bind(null, slug, event);
        return (
          <div
            key={event}
            className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6"
          >
            <p className="eyebrow mb-5">
              {event} media kit for {portal.companyName}
            </p>
            <form action={updateAction}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="eyebrow mb-2">LinkedIn-ready image</p>
                  <ImageDropField
                    name="image"
                    removeFieldName="removeImage"
                    hasExistingImage={kit.hasImage}
                    imageSrc={`/api/media-kit/${slug}/${mediaKitEventSlug(event)}`}
                  />
                </div>
                <div>
                  <p className="eyebrow mb-2">Ready-to-post copy</p>
                  <textarea
                    name="copy"
                    defaultValue={kit.copy ?? ""}
                    placeholder="Copy this partner can paste straight into a LinkedIn post…"
                    rows={9}
                    className="w-full rounded-[10px] border px-3 py-2 text-fg-1 placeholder:text-fg-5"
                    style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
                  />
                </div>
              </div>
              <SaveMediaKitButton>
                Save {event} media kit for {portal.companyName}
              </SaveMediaKitButton>
            </form>
          </div>
        );
      })}

      {portal.internalNotes && (
        <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
          <p className="eyebrow mb-2">Internal notes (staff only)</p>
          <p className="whitespace-pre-wrap text-sm text-fg-3 leading-[1.55]">
            {portal.internalNotes}
          </p>
        </div>
      )}
    </main>
  );
}
