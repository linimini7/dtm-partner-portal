import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMediaKit, getRawPortalContent, mediaKitEventSlug } from "@/lib/portal-content";
import { listDtmContacts } from "@/lib/dtm-contacts";
import ImageDropField from "../../p/[slug]/ImageDropField";
import SaveMediaKitButton from "../../p/[slug]/admin/SaveMediaKitButton";
import {
  addDtmContactAction,
  deleteDtmContactAction,
  updateDtmContactAction,
  updateGlobalExhibitorGuidelines,
  updateGlobalFloorPlanUrl,
  updateGlobalHotelBookingUrl,
  updateGlobalMediaKit,
} from "./actions";

export default async function PortalSettingsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const content = await getRawPortalContent("global");
  const globalMediaKit = await getMediaKit("global");
  const dtmContacts = await listDtmContacts();
  const updateFloorPlanDtm27 = updateGlobalFloorPlanUrl.bind(null, "DTM27");
  const updateFloorPlanSparta27 = updateGlobalFloorPlanUrl.bind(null, "SPARTA 2027");
  const updateMediaKitDtm27 = updateGlobalMediaKit.bind(null, "DTM27");
  const updateMediaKitSparta27 = updateGlobalMediaKit.bind(null, "SPARTA 2027");

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div>
        <Link href="/portals" className="text-sm">
          ← All portals
        </Link>
        <h1 className="mt-2 text-2xl text-fg-1">Global portal settings</h1>
        <p className="mt-1 text-sm text-fg-4">
          Applies to every partner portal, unless a specific partner has its own override set on
          their <code>/admin</code> page — including the media kit below, which is the default a
          partner sees until they upload their own on their own admin page.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">DTM team contacts</p>
        <p className="mb-4 text-sm text-fg-4">
          Who every partner sees under &quot;Your point of contact.&quot; Editing someone here
          (their email, phone, or a status like &quot;On maternal leave&quot;) updates it on every
          partner&apos;s portal immediately — no need to touch Attio. Add another person if
          someone needs to be covered for or added.
        </p>
        <div className="flex flex-col gap-4">
          {dtmContacts.map((c) => {
            const updateThis = updateDtmContactAction.bind(null, c.id);
            const deleteThis = deleteDtmContactAction.bind(null, c.id);
            return (
              <form
                key={c.id}
                action={updateThis}
                className="grid gap-3 rounded-[10px] border border-dtm-hairline p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-3">Name</span>
                  <input
                    type="text"
                    name="name"
                    defaultValue={c.name}
                    required
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-3">Role</span>
                  <input
                    type="text"
                    name="role"
                    defaultValue={c.role ?? ""}
                    placeholder="e.g. Head of Operations"
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-3">Email</span>
                  <input
                    type="email"
                    name="contactEmail"
                    defaultValue={c.email ?? ""}
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-3">Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={c.phone ?? ""}
                    placeholder="Add phone number"
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <label className="block text-sm sm:col-span-2 lg:col-span-3">
                  <span className="mb-1 block text-fg-3">Status (optional)</span>
                  <input
                    type="text"
                    name="status"
                    defaultValue={c.status ?? ""}
                    placeholder="e.g. On maternal leave — contact Jonas instead"
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-1">
                  <button
                    type="submit"
                    className="rounded-[8px] px-4 py-2 text-sm font-medium"
                    style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
                  >
                    Save
                  </button>
                  <button
                    type="submit"
                    formAction={deleteThis}
                    className="rounded-[8px] border border-dtm-hairline px-4 py-2 text-sm text-fg-3"
                  >
                    Remove
                  </button>
                </div>
              </form>
            );
          })}

          <form
            action={addDtmContactAction}
            className="grid gap-3 rounded-[10px] border border-dashed border-dtm-hairline p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <p className="text-sm text-fg-3 sm:col-span-2 lg:col-span-4">Add another contact</p>
            <label className="block text-sm">
              <span className="mb-1 block text-fg-3">Name</span>
              <input
                type="text"
                name="name"
                required
                className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-fg-3">Role</span>
              <input
                type="text"
                name="role"
                placeholder="e.g. Head of Operations"
                className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-fg-3">Email</span>
              <input
                type="email"
                name="contactEmail"
                className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-fg-3">Phone</span>
              <input
                type="tel"
                name="phone"
                placeholder="Add phone number"
                className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
              />
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-3">
              <span className="mb-1 block text-fg-3">Status (optional)</span>
              <input
                type="text"
                name="status"
                placeholder="e.g. On maternal leave — contact Jonas instead"
                className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded-[8px] px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
            >
              Add contact
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-6">
          <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
            <p className="eyebrow mb-2">Exhibitor guidelines</p>
            <p className="mb-4 text-sm text-fg-4">
              The link every partner sees under &quot;Coming your way&quot; → Exhibitor
              guidelines. Changing it updates it for every partner immediately.
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
            <p className="eyebrow mb-2">Media kit</p>
            <p className="mb-4 text-sm text-fg-4">
              The default LinkedIn-ready image and ready-to-post copy a partner sees under their
              media kit, per event — until they upload their own on their own admin page, which
              always takes over from this.
            </p>

            <div className="flex flex-col gap-6">
              <div>
                <p className="mb-3 text-sm font-medium text-fg-2">DTM27 media kit</p>
                <form action={updateMediaKitDtm27}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImageDropField
                      name="image"
                      removeFieldName="removeImage"
                      hasExistingImage={globalMediaKit.DTM27.hasImage}
                      imageSrc={`/api/media-kit/global/${mediaKitEventSlug("DTM27")}`}
                    />
                    <textarea
                      name="copy"
                      defaultValue={globalMediaKit.DTM27.copy ?? ""}
                      placeholder="Default copy a partner can paste straight into a LinkedIn post…"
                      rows={6}
                      className="w-full rounded-[10px] border px-3 py-2 text-fg-1 placeholder:text-fg-5"
                      style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
                    />
                  </div>
                  <SaveMediaKitButton>Save DTM27 media kit</SaveMediaKitButton>
                </form>
              </div>

              <div className="border-t border-dtm-hairline pt-6">
                <p className="mb-3 text-sm font-medium text-fg-2">SPARTA27 media kit</p>
                <form action={updateMediaKitSparta27}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImageDropField
                      name="image"
                      removeFieldName="removeImage"
                      hasExistingImage={globalMediaKit["SPARTA 2027"].hasImage}
                      imageSrc={`/api/media-kit/global/${mediaKitEventSlug("SPARTA 2027")}`}
                    />
                    <textarea
                      name="copy"
                      defaultValue={globalMediaKit["SPARTA 2027"].copy ?? ""}
                      placeholder="Default copy a partner can paste straight into a LinkedIn post…"
                      rows={6}
                      className="w-full rounded-[10px] border px-3 py-2 text-fg-1 placeholder:text-fg-5"
                      style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
                    />
                  </div>
                  <SaveMediaKitButton>Save SPARTA27 media kit</SaveMediaKitButton>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
            <p className="eyebrow mb-2">Floor plans</p>
            <p className="mb-4 text-sm text-fg-4">
              The link every partner sees under Quick Links → Floor plan, per event. Each event
              has its own venue, so its own plan.
            </p>
            <div className="flex flex-col gap-6">
              <form action={updateFloorPlanDtm27} className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-3">DTM27 floor plan URL</span>
                  <input
                    type="url"
                    name="floorPlanUrl"
                    defaultValue={content.floorPlanUrls.DTM27 ?? ""}
                    placeholder="https://…"
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-[8px] px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
                >
                  Save DTM27 floor plan
                </button>
              </form>
              <form action={updateFloorPlanSparta27} className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-fg-3">SPARTA27 floor plan URL</span>
                  <input
                    type="url"
                    name="floorPlanUrl"
                    defaultValue={content.floorPlanUrls["SPARTA 2027"] ?? ""}
                    placeholder="https://…"
                    className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-[8px] px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
                >
                  Save SPARTA27 floor plan
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
            <p className="eyebrow mb-2">Hotel booking</p>
            <p className="mb-4 text-sm text-fg-4">
              The link every partner sees under Quick Links → Hotel booking, for every event.
              Changing it updates it for every partner in one click.
            </p>
            <form action={updateGlobalHotelBookingUrl} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-fg-3">Hotel booking URL</span>
                <input
                  type="url"
                  name="hotelBookingUrl"
                  defaultValue={content.hotelBookingUrl ?? ""}
                  placeholder="https://…"
                  className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
                />
              </label>
              <button
                type="submit"
                className="rounded-[8px] px-4 py-2 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
              >
                Save hotel booking URL
              </button>
            </form>
          </div>
        </div>
      </div>

    </main>
  );
}
