"use client";

import { useState } from "react";
import { updatePartnerContact } from "./brand-actions";

/**
 * Lets a partner propose/update their own point of contact. Doesn't
 * silently become the displayed contact when staff have already set one in
 * Attio (see lib/brand-assets.ts's upsertPartnerContact) — it's logged to
 * the staff activity feed either way, so this reads as "propose" more than
 * "edit" when a real Attio contact already exists.
 */
export default function PartnerContactEditor({
  slug,
  initialName,
  initialEmail,
}: {
  slug: string;
  initialName: string;
  initialEmail: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function handleSave() {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await updatePartnerContact(slug, name, email);
      setJustSaved(true);
      setEditing(false);
      setTimeout(() => setJustSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 text-[11px] text-left"
        style={{ color: justSaved ? "var(--ok)" : "var(--accent)" }}
      >
        {justSaved ? "Sent to DTM ✓" : "Nominate or change this →"}
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="rounded-[6px] border px-2 py-1 text-[12px] text-fg-1 placeholder:text-fg-5"
        style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="rounded-[6px] border px-2 py-1 text-[12px] text-fg-1 placeholder:text-fg-5"
        style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !email.trim()}
          className="rounded-[6px] px-2 py-1 text-[11px] font-medium disabled:opacity-70"
          style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="text-[11px] text-fg-5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
