import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStaffDirectory, listPortalCompanies } from "@/lib/data";
import { getPortalCode } from "@/lib/portal-code";
import PortalsTable, { type Row } from "./PortalsTable";

export default async function PortalsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const [companies, staff] = await Promise.all([
    listPortalCompanies(),
    getStaffDirectory(),
  ]);

  const rows: Row[] = companies.map((c) => ({
    ...c,
    csLeadName: c.csLeadId ? (staff[c.csLeadId]?.name ?? "") : "",
    salesLeadName: c.salesLeadId ? (staff[c.salesLeadId]?.name ?? "") : "",
    accessCode: getPortalCode(c.slug),
  }));

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
      <PortalsTable rows={rows} staffEmail={session.user?.email} />
    </main>
  );
}
