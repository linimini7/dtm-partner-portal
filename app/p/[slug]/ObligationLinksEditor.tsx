"use client";

import { useState } from "react";
import { saveObligationLinks } from "./brand-actions";

/**
 * Evidence links a partner attaches to an obligation (e.g. the actual
 * LinkedIn post URLs and a newsletter mention under "Publicly announce the
 * partnership") — a free-form, expandable list rather than a single field,
 * since a partner might post more than once. Always submits its whole
 * current list on Save rather than saving each row individually.
 */
export default function ObligationLinksEditor({
  slug,
  obligationId,
  initialLinks,
}: {
  slug: string;
  obligationId: string;
  initialLinks: string[];
}) {
  const [links, setLinks] = useState<string[]>(initialLinks.length > 0 ? initialLinks : [""]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function updateLink(index: number, value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? value : l)));
  }

  function addLink() {
    setLinks((prev) => [...prev, ""]);
  }

  function removeLink(index: number) {
    setLinks((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [""]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveObligationLinks(slug, obligationId, links);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-dtm-hairline pt-2.5">
      <div className="text-[11px] text-fg-5">
        Links to your post(s) — e.g. a couple of LinkedIn posts and a newsletter mention
      </div>
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={link}
            onChange={(e) => updateLink(i, e.target.value)}
            placeholder="https://…"
            className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
            style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
          />
          {links.length > 1 && (
            <button
              type="button"
              onClick={() => removeLink(i)}
              aria-label="Remove link"
              className="shrink-0 text-fg-5"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={addLink} className="text-sm" style={{ color: "var(--accent)" }}>
          + Add another link
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-[8px] px-3 py-1.5 text-sm font-medium disabled:opacity-70"
          style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
        >
          {saving ? "Saving…" : justSaved ? "Saved!" : "Save links"}
        </button>
      </div>
    </div>
  );
}
