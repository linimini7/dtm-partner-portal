"use client";

import { useState } from "react";
import { saveObligationNominees } from "./brand-actions";
import type { Nominee } from "@/lib/obligation-shared";

const EMPTY_NOMINEE: Nominee = { fullName: "", position: "", email: "" };

/**
 * Named attendees a partner supplies for a "nominate someone" obligation
 * (Guardians, LP-GP Marketplace, CXO/CVC Summit, investor dinner) — a free
 * -form, expandable list since more than one person can be named. Always
 * submits its whole current list on Save, same pattern as
 * ObligationLinksEditor.
 */
export default function NomineeEditor({
  slug,
  obligationId,
  title,
  initialNominees,
}: {
  slug: string;
  obligationId: string;
  title: string;
  initialNominees: Nominee[];
}) {
  const [nominees, setNominees] = useState<Nominee[]>(
    initialNominees.length > 0 ? initialNominees : [EMPTY_NOMINEE],
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function updateNominee(index: number, field: keyof Nominee, value: string) {
    setNominees((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value } : n)));
  }

  function addNominee() {
    setNominees((prev) => [...prev, EMPTY_NOMINEE]);
  }

  function removeNominee(index: number) {
    setNominees((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [EMPTY_NOMINEE]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveObligationNominees(slug, obligationId, title, nominees);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2.5 border-t border-dtm-hairline pt-2.5">
      <div className="text-[11px] text-fg-5">Who&apos;s coming — full name, position, and email address</div>
      {nominees.map((nominee, i) => (
        <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <input
            type="text"
            value={nominee.fullName}
            onChange={(e) => updateNominee(i, "fullName", e.target.value)}
            placeholder="Full name"
            className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
            style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
          />
          <input
            type="text"
            value={nominee.position}
            onChange={(e) => updateNominee(i, "position", e.target.value)}
            placeholder="Position"
            className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
            style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
          />
          <input
            type="email"
            value={nominee.email}
            onChange={(e) => updateNominee(i, "email", e.target.value)}
            placeholder="Email address"
            className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
            style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
          />
          {nominees.length > 1 && (
            <button
              type="button"
              onClick={() => removeNominee(i)}
              aria-label="Remove nominee"
              className="shrink-0 self-end text-fg-5 sm:self-auto"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={addNominee} className="text-sm" style={{ color: "var(--accent)" }}>
          + Add another person
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-[8px] px-3 py-1.5 text-sm font-medium disabled:opacity-70"
          style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
        >
          {saving ? "Saving…" : justSaved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}
