"use client";

import { useState } from "react";
import { updatePartnerContact, updateSecondPartnerContact } from "./brand-actions";

interface ContactValue {
  name: string | null;
  email: string | null;
  phone: string | null;
}

/** Two-letter initials for the avatar circle — from the person's name if we have one, else the first two letters of their email's local part. */
function initials(contact: ContactValue): string {
  const source = contact.name?.trim() || contact.email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

function Avatar({ contact }: { contact: ContactValue }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium"
      style={{ background: "var(--dtm-surface-2)", color: "var(--fg-3)" }}
    >
      {initials(contact)}
    </div>
  );
}

/**
 * One "Point of contact" card covering both the primary contact and an
 * optional second one — some partners have a signatory who isn't who's
 * actually reachable day-to-day, and want both listed without it reading as
 * two separate, unrelated cards. A single "Edit or nominate another one"
 * link opens both; the second contact's fields only appear once "Add
 * additional POC" is clicked (or immediately if one is already on file, so
 * editing it doesn't need an extra click). Saves are logged to the staff
 * activity feed either way — this reads as "propose" more than "edit" once
 * a real Attio contact already exists (see lib/brand-assets.ts).
 */
export default function PartnerContactsCard({
  slug,
  primary,
  secondary,
}: {
  slug: string;
  primary: ContactValue | null;
  secondary: ContactValue | null;
}) {
  const [editing, setEditing] = useState(false);
  const [primaryName, setPrimaryName] = useState(primary?.name ?? "");
  const [primaryEmail, setPrimaryEmail] = useState(primary?.email ?? "");
  const [primaryPhone, setPrimaryPhone] = useState(primary?.phone ?? "");
  const [showSecondary, setShowSecondary] = useState(Boolean(secondary?.email?.trim()));
  const [secondaryName, setSecondaryName] = useState(secondary?.name ?? "");
  const [secondaryEmail, setSecondaryEmail] = useState(secondary?.email ?? "");
  const [secondaryPhone, setSecondaryPhone] = useState(secondary?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function openEditor() {
    // Reset drafts to whatever's currently on file, in case this reopens
    // after an earlier save already changed it.
    setPrimaryName(primary?.name ?? "");
    setPrimaryEmail(primary?.email ?? "");
    setPrimaryPhone(primary?.phone ?? "");
    setShowSecondary(Boolean(secondary?.email?.trim()));
    setSecondaryName(secondary?.name ?? "");
    setSecondaryEmail(secondary?.email ?? "");
    setSecondaryPhone(secondary?.phone ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!primaryEmail.trim()) return;
    setSaving(true);
    try {
      await updatePartnerContact(slug, primaryName, primaryEmail, primaryPhone);
      if (showSecondary) {
        await updateSecondPartnerContact(slug, secondaryName, secondaryEmail, secondaryPhone);
      }
      setJustSaved(true);
      setEditing(false);
      setTimeout(() => setJustSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "rounded-[6px] border px-2 py-1 text-[12px] text-fg-1 placeholder:text-fg-5";
  const inputStyle = { background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" };

  return (
    <div className="border border-dtm-hairline rounded-[10px] p-3.5 flex flex-col gap-2.5">
      {primary ? (
        <div className="flex items-center gap-2.5">
          <Avatar contact={primary} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-fg-1">{primary.name ?? primary.email}</div>
            {primary.email && <div className="truncate text-[11.5px] text-fg-4">{primary.email}</div>}
            {primary.phone && <div className="text-[11.5px] text-fg-4">{primary.phone}</div>}
          </div>
        </div>
      ) : (
        <div className="text-[11.5px] text-fg-4">Point of contact not set yet</div>
      )}

      {secondary?.email && (
        <div className="flex items-center gap-2.5">
          <Avatar contact={secondary} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-fg-1">{secondary.name ?? secondary.email}</div>
            <div className="truncate text-[11.5px] text-fg-4">{secondary.email}</div>
            {secondary.phone && <div className="text-[11.5px] text-fg-4">{secondary.phone}</div>}
          </div>
        </div>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={openEditor}
          className="text-left text-[11px]"
          style={{ color: justSaved ? "var(--ok)" : "var(--accent)" }}
        >
          {justSaved ? "Sent to DTM ✓" : "Edit or nominate another one →"}
        </button>
      ) : (
        <div className="mt-1 flex flex-col gap-1.5">
          <input
            type="text"
            value={primaryName}
            onChange={(e) => setPrimaryName(e.target.value)}
            placeholder="Name"
            className={inputClass}
            style={inputStyle}
          />
          <input
            type="email"
            value={primaryEmail}
            onChange={(e) => setPrimaryEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
            style={inputStyle}
          />
          <input
            type="tel"
            value={primaryPhone}
            onChange={(e) => setPrimaryPhone(e.target.value)}
            placeholder="Phone (for quick reach)"
            className={inputClass}
            style={inputStyle}
          />

          {showSecondary ? (
            <>
              <div className="eyebrow mt-1.5">Additional POC</div>
              <input
                type="text"
                value={secondaryName}
                onChange={(e) => setSecondaryName(e.target.value)}
                placeholder="Name"
                className={inputClass}
                style={inputStyle}
              />
              <input
                type="email"
                value={secondaryEmail}
                onChange={(e) => setSecondaryEmail(e.target.value)}
                placeholder="Email"
                className={inputClass}
                style={inputStyle}
              />
              <input
                type="tel"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="Phone (for quick reach)"
                className={inputClass}
                style={inputStyle}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecondary(true)}
              className="mt-0.5 text-left text-[11px]"
              style={{ color: "var(--accent)" }}
            >
              + Add additional POC
            </button>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !primaryEmail.trim()}
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
      )}
    </div>
  );
}
