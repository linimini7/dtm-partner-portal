"use client";

import { useState } from "react";
import { saveObligationTopic } from "./brand-actions";

/**
 * A single free-text field for a "submit your topic" obligation (a speaking
 * slot or co-curated session's working title) — unlike ObligationLinksEditor
 * or NomineeEditor, there's only ever one value here, so no add/remove list.
 */
export default function TopicEditor({
  slug,
  obligationId,
  title,
  initialTopic,
}: {
  slug: string;
  obligationId: string;
  title: string;
  initialTopic: string;
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveObligationTopic(slug, obligationId, title, topic);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-dtm-hairline pt-2.5">
      <div className="text-[11px] text-fg-5">Working title or topic</div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Scaling dual-use hardware in Europe"
          className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
          style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 rounded-[8px] px-3 py-1.5 text-sm font-medium disabled:opacity-70"
          style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
        >
          {saving ? "Saving…" : justSaved ? "Saved!" : "Save topic"}
        </button>
      </div>
    </div>
  );
}
