"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteDtmContactAction, updateDtmContactAction } from "./actions";
import type { DtmContact } from "@/lib/dtm-contacts";

/**
 * One DTM contact's edit row — a client component specifically so Save can
 * show real feedback (Saving… / Saved!). The plain server-action form this
 * replaced gave no visible confirmation at all: the save genuinely worked
 * every time (verified directly against the database and the live site),
 * but with nothing on screen to show for it, it read as broken.
 */
export default function DtmContactForm({ contact }: { contact: DtmContact }) {
  const [, formAction, isPending] = useActionState(async (_prev: null, formData: FormData) => {
    await updateDtmContactAction(contact.id, formData);
    return null;
  }, null);
  const wasPending = useRef(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timeout);
    }
    wasPending.current = isPending;
  }, [isPending]);

  const deleteThis = deleteDtmContactAction.bind(null, contact.id);

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-[10px] border border-dtm-hairline p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-fg-3">Name</span>
        <input
          type="text"
          name="name"
          defaultValue={contact.name}
          required
          className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-fg-3">Role</span>
        <input
          type="text"
          name="role"
          defaultValue={contact.role ?? ""}
          placeholder="e.g. Head of Operations"
          className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-fg-3">Email</span>
        <input
          type="email"
          name="contactEmail"
          defaultValue={contact.email ?? ""}
          className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-fg-3">Phone</span>
        <input
          type="tel"
          name="phone"
          defaultValue={contact.phone ?? ""}
          placeholder="Add phone number"
          className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
        />
      </label>
      <label className="block text-sm sm:col-span-2 lg:col-span-3">
        <span className="mb-1 block text-fg-3">Status (optional)</span>
        <input
          type="text"
          name="status"
          defaultValue={contact.status ?? ""}
          placeholder="e.g. On maternal leave — contact Jonas instead"
          className="w-full rounded-[8px] border border-dtm-hairline bg-dtm-ink px-3 py-2 text-fg-1"
        />
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[8px] px-4 py-2 text-sm font-medium disabled:opacity-70"
          style={{
            background: justSaved ? "var(--ok)" : "var(--accent)",
            color: justSaved ? "#fff" : "var(--dtm-ink)",
          }}
        >
          {isPending ? "Saving…" : justSaved ? "Saved!" : "Save"}
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
}
