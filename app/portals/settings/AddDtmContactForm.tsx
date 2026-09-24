"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addDtmContactAction } from "./actions";

/** Same Saving…/Added! feedback as DtmContactForm, plus clearing the fields once the add actually lands — this form is meant for repeated use, unlike the per-person edit rows. */
export default function AddDtmContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [, formAction, isPending] = useActionState(async (_prev: null, formData: FormData) => {
    await addDtmContactAction(formData);
    return null;
  }, null);
  const wasPending = useRef(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      formRef.current?.reset();
      setJustAdded(true);
      const timeout = setTimeout(() => setJustAdded(false), 2000);
      return () => clearTimeout(timeout);
    }
    wasPending.current = isPending;
  }, [isPending]);

  return (
    <form
      ref={formRef}
      action={formAction}
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
        disabled={isPending}
        className="self-start rounded-[8px] px-4 py-2 text-sm font-medium disabled:opacity-70"
        style={{
          background: justAdded ? "var(--ok)" : "var(--accent)",
          color: justAdded ? "#fff" : "var(--dtm-ink)",
        }}
      >
        {isPending ? "Adding…" : justAdded ? "Added!" : "Add contact"}
      </button>
    </form>
  );
}
