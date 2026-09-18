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
    getRecentActivity(10),
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
      };
    }),
  );
  const companyNames = Object.fromEntries(companies.map((c) => [c.slug, c.companyName]));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">DTM Partner Portal · Staff</p>
          <h1 className="text-3xl">Partner portals</h1>
        </div>
        <Link href="/portals/settings" className="text-sm">
          Global portal settings →
        </Link>
      </div>
      <div className="mb-6">
        <ActivityFeed entries={recentActivity} companyNames={companyNames} />
      </div>
      <PortalsTable rows={rows} staffEmail={session.user?.email} />
    </main>
  );
}
