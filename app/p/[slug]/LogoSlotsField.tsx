"use client";

import { useRef, useState } from "react";

interface SlotState {
  slot: number;
  existingHasImage: boolean;
  existingFormat: string | null;
  file: File | null;
  previewUrl: string | null;
  removed: boolean;
}

/** Short display label for a tile's format badge ("PNG", "EPS", ...) — mirrors lib/brand-assets.ts's logoFormatLabel, but for a freshly picked File that hasn't been saved yet. */
function fileFormatLabel(file: File): string {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext) return ext === "jpeg" ? "JPG" : ext.toUpperCase();
  const mimeMatch = file.type.match(/^image\/([a-z0-9+.-]+)$/);
  if (mimeMatch) {
    const sub = mimeMatch[1];
    if (sub === "jpeg") return "JPG";
    if (sub === "svg+xml") return "SVG";
    return sub.toUpperCase();
  }
  return "FILE";
}

/** No browser can render EPS inline as an `<img>` — everything else in this app's accepted logo formats (png/jpg/gif/webp/svg) previews fine. */
function isEpsFormat(format: string): boolean {
  return format === "EPS";
}

/** Small format-label chip shown in a tile's top-right corner — for every filled slot, not just unsupported ones. */
function FormatBadge({ format }: { format: string }) {
  return (
    <span
      className="absolute top-1 right-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em]"
      style={{ background: "var(--dtm-ink)", color: "var(--fg-3)" }}
    >
      {format}
    </span>
  );
}

/** Shown in place of a broken `<img>` for a format nothing in the browser can preview. */
function EpsTile() {
  return <span className="px-2 text-center text-[10px] text-fg-5">No preview</span>;
}

/**
 * Up to 5 logo tiles inside the single combined brand-assets form (see
 * BrandAssetsCard) — nothing here submits on its own. A tile only counts as
 * "filled" once a Save actually persists it; until then this just tracks
 * pending picks/removals locally. Only filled slots plus exactly one empty
 * "next" tile are shown, so a partner who has uploaded 2 logos sees 2 tiles
 * plus 1 empty one to add a 3rd, not 5 empty boxes.
 */
export default function LogoSlotsField({
  slug,
  initialSlots,
}: {
  slug: string;
  initialSlots: { slot: number; hasImage: boolean; format: string | null }[];
}) {
  const [slots, setSlots] = useState<SlotState[]>(
    initialSlots.map((s) => ({
      slot: s.slot,
      existingHasImage: s.hasImage,
      existingFormat: s.format,
      file: null,
      previewUrl: null,
      removed: false,
    })),
  );
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  function isFilled(s: SlotState): boolean {
    return (s.existingHasImage && !s.removed) || !!s.file;
  }

  const lastFilledIndex = slots.reduce((max, s, i) => (isFilled(s) ? i : max), -1);
  // Nothing uploaded yet: show 5 open options (not all — there can be up to
  // MAX_LOGO_SLOTS). Once at least one is filled, only show the filled ones
  // plus exactly one empty "next" tile.
  const INITIAL_EMPTY_SLOTS = 5;
  const visibleCount =
    lastFilledIndex === -1
      ? Math.min(slots.length, INITIAL_EMPTY_SLOTS)
      : Math.min(slots.length, lastFilledIndex + 2);
  const visibleSlots = slots.slice(0, visibleCount);

  function setFile(index: number, file: File | null) {
    if (!file) return;
    setSlots((prev) => {
      const next = [...prev];
      const prevUrl = next[index].previewUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      next[index] = { ...next[index], file, previewUrl: URL.createObjectURL(file), removed: false };
      return next;
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      const prevUrl = next[index].previewUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      next[index] = { ...next[index], file: null, previewUrl: null, removed: true };
      return next;
    });
    const input = inputRefs.current[slots[index].slot];
    if (input) input.value = "";
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {visibleSlots.map((s, index) => {
        const filled = isFilled(s);
        const dragOver = dragOverSlot === s.slot;
        const format = s.file ? fileFormatLabel(s.file) : s.existingFormat;
        const eps = filled && !!format && isEpsFormat(format);
        return (
          <div key={s.slot} className="flex flex-col gap-1">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverSlot(s.slot);
              }}
              onDragLeave={() => setDragOverSlot((cur) => (cur === s.slot ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverSlot(null);
                setFile(index, e.dataTransfer.files?.[0] ?? null);
              }}
              onClick={() => inputRefs.current[s.slot]?.click()}
              className="relative flex h-24 items-center justify-center overflow-hidden rounded-[8px] border border-dashed cursor-pointer"
              style={{
                borderColor: dragOver ? "var(--accent)" : "var(--dtm-hairline-2)",
                background: dragOver ? "rgb(212 54 122 / 6%)" : "var(--dtm-ink-2)",
              }}
            >
              {filled ? (
                <>
                  {eps ? (
                    <EpsTile />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.previewUrl ?? `/api/portal-logo/${slug}/${s.slot}`}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                  {format && <FormatBadge format={format} />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSlot(index);
                    }}
                    className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
                    style={{ background: "var(--dtm-ink)", color: "var(--fg-3)" }}
                    aria-label="Remove logo"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="px-2 text-center text-[11px] text-fg-5">Add logo</span>
              )}
            </div>
            <div className="text-center text-[10px] text-fg-5">Logo {s.slot}</div>

            <input
              ref={(el) => {
                inputRefs.current[s.slot] = el;
              }}
              type="file"
              name={`logo_${s.slot}`}
              accept="image/*,.eps,application/postscript"
              className="hidden"
              onChange={(e) => setFile(index, e.target.files?.[0] ?? null)}
            />
            <input type="hidden" name={`removeLogo_${s.slot}`} value={s.removed ? "on" : ""} readOnly />
          </div>
        );
      })}
    </div>
  );
}
