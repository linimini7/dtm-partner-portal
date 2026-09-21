"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateBrandAll, type UpdateBrandAllResult } from "./brand-actions";
import LogoSlotsField from "./LogoSlotsField";
import type { BrandAssets } from "@/lib/brand-assets";
import { formatDate } from "@/lib/format-date";

const MAX_DESCRIPTION_WORDS = 250;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * "What we need from you" — the one card in the portal a partner can
 * actually write to, not just read (via their access-code session, same as
 * staff via /admin — both hit the same brand-actions.ts). It defaults to a
 * read-only view with a "Submit" button under the deadline; clicking it
 * reveals the live form, and a successful Save drops straight back to the
 * read-only view — there is never a lingering Save button once something is
 * saved, only "Submit" to go again.
 */
export default function BrandAssetsCard({
  slug,
  brandAssets,
  deadline,
}: {
  slug: string;
  brandAssets: BrandAssets;
  /** The real "submit by" date for logo/website/description, or null once nothing's missing — see lib/portal-view.ts's brandAssetsDeadline. */
  deadline: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [result, formAction, isPending] = useActionState(
    async (_prev: UpdateBrandAllResult | null, formData: FormData) => updateBrandAll(formData),
    null,
  );
  const wasPending = useRef(false);
  const [descriptionValue, setDescriptionValue] = useState(brandAssets.description ?? "");
  const words = wordCount(descriptionValue);
  const filledLogos = brandAssets.logoSlots.filter((s) => s.hasImage);
  const logoFillKey = brandAssets.logoSlots.map((s) => (s.hasImage ? "1" : "0")).join("");
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      // Stay in edit mode when the zip specifically failed, so the error
      // below is visible and they can pick a different file and retry —
      // everything else in the submit still saved either way.
      if (!result?.zipError) {
        // A deliberate exception to "don't setState in an effect": this
        // reacts to the action's own pending→settled transition, which
        // can't be observed any other way from outside the form.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditing(false);
      }
    }
    wasPending.current = isPending;
  }, [isPending, result]);

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold text-fg-1">What we need from you</div>
            <div className="text-[12.5px] text-fg-4">
              Your logo, a short description and your website.
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {deadline && (
              <div className="text-right">
                <div className="eyebrow">Submit by</div>
                <div className="font-mono text-[13px] font-semibold" style={{ color: "var(--warn)" }}>
                  {formatDate(deadline)}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-[8px] border border-dtm-hairline px-3 py-1.5 text-sm font-medium text-fg-2 whitespace-nowrap"
            >
              Submit
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-fg-5">Website URL</span>
          {brandAssets.websiteUrl ? (
            <a
              href={brandAssets.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm"
            >
              {brandAssets.websiteUrl} ↗
            </a>
          ) : (
            <span className="text-sm text-fg-5">Not added yet</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-fg-5">Description</span>
          {brandAssets.description ? (
            <p className="whitespace-pre-wrap text-sm text-fg-2">{brandAssets.description}</p>
          ) : (
            <span className="text-sm text-fg-5">Not added yet</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-fg-5">Logos</span>
          {filledLogos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {filledLogos.map(({ slot }) => (
                <a
                  key={slot}
                  href={`/api/portal-logo/${slug}/${slot}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-24 items-center justify-center overflow-hidden rounded-[8px] border"
                  style={{ borderColor: "var(--dtm-hairline-2)", background: "var(--dtm-ink-2)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/portal-logo/${slug}/${slot}`}
                    alt={`Logo ${slot}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </a>
              ))}
            </div>
          ) : (
            <span className="text-sm text-fg-5">Not added yet</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <div className="text-[15px] font-semibold text-fg-1">What we need from you</div>
        <div className="text-[12.5px] text-fg-4">
          Your logo, a short description and your website — fill this in whenever you&apos;re
          ready, it goes live immediately.
        </div>
      </div>

      <input type="hidden" name="slug" value={slug} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-3">Website URL</span>
        <input
          type="text"
          name="websiteUrl"
          defaultValue={brandAssets.websiteUrl ?? ""}
          placeholder="https://…"
          className="rounded-[8px] border px-3 py-2 text-fg-1 placeholder:text-fg-5"
          style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-fg-3">Description</span>
          <span
            className="font-mono text-[11px]"
            style={{ color: words > MAX_DESCRIPTION_WORDS ? "var(--alert)" : "var(--fg-5)" }}
          >
            {words}/{MAX_DESCRIPTION_WORDS} words
          </span>
        </div>
        <textarea
          name="description"
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
          placeholder="A short description of your company for DTM to use across your partnership materials…"
          rows={4}
          className="rounded-[10px] border px-3 py-2 text-fg-1 placeholder:text-fg-5"
          style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
        />
      </label>

      <div>
        <div className="mb-2 text-sm text-fg-3">Logos (up to 20, high resolution)</div>
        <LogoSlotsField key={logoFillKey} slug={slug} initialSlots={brandAssets.logoSlots} />

        <div className="mt-3 flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => zipInputRef.current?.click()}
            className="rounded-[8px] border border-dtm-hairline px-3 py-1.5 text-fg-2"
          >
            Or upload a .zip of all your logos
          </button>
          {zipFileName && <span className="text-fg-4">{zipFileName}</span>}
          <input
            ref={zipInputRef}
            type="file"
            name="logosZip"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={(e) => setZipFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>
        {result?.zipError && (
          <div className="mt-2 text-sm" style={{ color: "var(--alert)" }}>
            {result.zipError}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[8px] px-4 py-2 text-sm font-medium disabled:opacity-70"
          style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={isPending}
          className="rounded-[8px] border border-dtm-hairline px-4 py-2 text-sm text-fg-2 disabled:opacity-70"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
