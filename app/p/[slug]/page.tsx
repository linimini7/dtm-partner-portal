import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPortalBySlug, getStaffDirectory } from "@/lib/data";
import { getEffectivePortalContent, getMediaKit } from "@/lib/portal-content";
import { getBrandAssets, getEmailDerivedContact } from "@/lib/brand-assets";
import { getCheckedObligationIds, getObligationLinks, getObligationNominees, isNomineeObligation, type Nominee } from "@/lib/obligation-checks";
import { getTicketCodes } from "@/lib/ticket-codes";
import { verifyPortalCode } from "@/lib/portal-code";
import { buildPortalView } from "@/lib/portal-view";
import CodeGate from "./CodeGate";
import PortalShell from "./PortalShell";

export default async function PortalPage({
  params,
  searchParams,
}: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const portal = await getPortalBySlug(slug);
  if (!portal) notFound();

  if (portal.variant === "unsupported") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-fg-2">
        <h1 className="mb-3 text-2xl text-fg-1">{portal.companyName}</h1>
        <p>
          This company&apos;s events ({portal.events.join(", ") || "none recorded"}) don&apos;t
          match a supported v1 portal variant — most likely a Public Delegation. That variant is
          out of scope for this phase (see the brief&apos;s Phase 5 placement). No portal is
          rendered.
        </p>
      </main>
    );
  }

  // Staff (Google SSO) always get in. Everyone else needs this portal's own
  // access code — see lib/portal-code.ts. No partner account model exists.
  const session = await auth();
  if (!session) {
    const cookieStore = await cookies();
    const submittedCode = cookieStore.get(`pa_${slug}`)?.value;
    if (!submittedCode || !verifyPortalCode(slug, submittedCode)) {
      const sp = await searchParams;
      return <CodeGate slug={slug} companyName={portal.companyName} invalid={sp.invalid === "1"} />;
    }
  }

  const staff = await getStaffDirectory();
  const salesLead = portal.salesLeadId ? staff[portal.salesLeadId] : undefined;
  const view = buildPortalView(portal);
  const portalContent = await getEffectivePortalContent(slug);
  const mediaKit = await getMediaKit(slug);
  const brandAssets = await getBrandAssets(slug);
  // Prefer a staff-confirmed Attio "poc" over whatever email-ingestion
  // picked up on its own — same precedence admin/page.tsx uses.
  const partnerContact = portal.poc
    ? { name: portal.poc.name, email: portal.poc.email }
    : await getEmailDerivedContact(slug);
  const checkedObligationIds = Array.from(await getCheckedObligationIds(slug));
  const announceLinks = await getObligationLinks(slug, "announce");
  const nomineeObligationIds = view.partnerObligations.map((o) => o.id).filter(isNomineeObligation);
  const nomineesByObligation: Record<string, Nominee[]> = Object.fromEntries(
    await Promise.all(
      nomineeObligationIds.map(async (id) => [id, await getObligationNominees(slug, id)] as const),
    ),
  );
  const ticketCodes = await getTicketCodes(slug);

  return (
    <PortalShell
      view={view}
      salesLead={salesLead}
      partnerContact={partnerContact}
      isStaff={Boolean(session)}
      portalContent={portalContent}
      mediaKit={mediaKit}
      brandAssets={brandAssets}
      checkedObligationIds={checkedObligationIds}
      announceLinks={announceLinks}
      nomineesByObligation={nomineesByObligation}
      ticketCodes={ticketCodes}
      slug={slug}
    />
  );
}
