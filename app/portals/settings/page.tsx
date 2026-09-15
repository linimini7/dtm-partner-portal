import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRawPortalContent } from "@/lib/portal-content";
import { updateGlobalExhibitorGuidelines, updateGlobalPlatformUrl } from "./actions";

export default async function PortalSettingsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const content = await getRawPortalContent("global");

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <Link href="/portals" className="text-sm">
          ← All portals
        </Link>
        <h1 className="mt-2 text-2xl text-fg-1">Global portal settings</h1>
        <p className="mt-1 text-sm text-fg-4">
          Applies to every partner portal, unless a specific partner has its own override set on
          their <code>/admin</code> page. Each partner&apos;s media kit is edited on that
          partner&apos;s own admin page instead — it isn&apos;t shared across partners.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">Exhibitor guidelines</p>
        <p className="mb-4 text-sm text-fg-4">
          The link every partner sees under &quot;Coming your way&quot; → Exhibitor guidelines.
          Changing it updates it for every partner immediately.
        </p>
        <form action={updateGlobalExhibitorGuidelines} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-fg-3">Exhibitor guidelines URL</span>
            <input
              type="url"
              name="exhibitorGuidelinesUrl"
              defaultValue={content.exhibitorGuidelinesUrl ?? ""}
              placeholder="https://…"
              className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
            />
          </label>
          <button
            type="submit"
            className="rounded-[8px] px-4 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
          >
            Save exhibitor guidelines URL
          </button>
        </form>
      </div>

      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">DTM27 platform</p>
        <p className="mb-4 text-sm text-fg-4">
          The link every partner sees under &quot;Coming your way&quot; → DTM27 platform. Changing
          it updates it for every partner immediately.
        </p>
        <form action={updateGlobalPlatformUrl} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-fg-3">DTM27 platform URL</span>
            <input
              type="url"
              name="platformUrl"
              defaultValue={content.platformUrl ?? ""}
              placeholder="https://…"
              className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
            />
          </label>
          <button
            type="submit"
            className="rounded-[8px] px-4 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
          >
            Save DTM27 platform URL
          </button>
        </form>
      </div>
    </main>
  );
}
