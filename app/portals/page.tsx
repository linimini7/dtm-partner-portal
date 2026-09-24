import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStaffDirectory, listPortalCompanies } from "@/lib/data";
import { getPortalCode } from "@/lib/portal-code";
import { getRecentActivity } from "@/lib/activity-log";
import { getBrandAssets } from "@/lib/brand-assets";
import { getCheckedObligationIds } from "@/lib/obligation-checks";
import { getPartnerObligationProgress } from "@/lib/portal-view";
import ActivityFeed from "./ActivityFeed";
import PortalsTable, { type Row } from "./PortalsTable";

export default async function PortalsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const [companies, staff, recentActivity] = await Promise.all([
    listPortalCompanies(),
    getStaffDirectory(),
    getRecentActivity(5),
  ]);

  const rows: Row[] = await Promise.all(
    companies.map(async (c) => {
      const [brandAssets, checkedObligationIds] = await Promise.all([
        getBrandAssets(c.slug),
        getCheckedObligationIds(c.slug),
      ]);
      const partnerProgress = getPartnerObligationProgress(c.partnerObligations, brandAssets, checkedObligationIds);
      return {
        ...c,
        csLeadName: c.csLeadId ? (staff[c.csLeadId]?.name ?? "") : "",
        salesLeadName: c.salesLeadId ? (staff[c.salesLeadId]?.name ?? "") : "",
        accessCode: getPortalCode(c.slug),
        partnerDeliverablesDone: partnerProgress.done,
        partnerDeliverablesTotal: partnerProgress.total,
        hasPngLogo: brandAssets.logoSlots.some((s) => s.format === "PNG"),
        hasVectorLogo: brandAssets.logoSlots.some((s) => s.format === "SVG" || s.format === "EPS"),
      };
    }),
  );
  const companyNames = Object.fromEntries(companies.map((c) => [c.slug, c.companyName]));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">DTM Partner Portal · Staff</p>
          <h1 className="text-3xl">Customer Success Platform</h1>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <HeaderIconLink href="/portals/activity" label="Notifications — recent partner activity">
              <BellIcon />
            </HeaderIconLink>
            <HeaderIconLink href="/portals/settings" label="Global portal settings">
              <GearIcon />
            </HeaderIconLink>
          </div>
          <p className="mt-2 text-sm text-fg-3">
            Welcome, {session.user?.name ?? session.user?.email}
          </p>
        </div>
      </div>
      <div className="mb-6">
        <ActivityFeed entries={recentActivity} companyNames={companyNames} />
      </div>
      <h2 className="mb-3 text-xl text-fg-1">Partner Portals – Overview</h2>
      <PortalsTable rows={rows} staffEmail={session.user?.email} />
    </main>
  );
}

function HeaderIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-panel)] border border-dtm-hairline text-fg-3 transition-colors hover:border-dtm-hairline-2 hover:text-fg-1"
    >
      {children}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
