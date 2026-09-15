"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that reflects the actual save state — pending while the server action runs, then a brief "Saved!" once it completes, since the page otherwise gives no visible sign the click did anything. */
export default function SaveMediaKitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const timeout = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timeout);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 rounded-[8px] px-4 py-2 text-sm font-medium disabled:opacity-70"
      style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
    >
      {pending ? "Saving…" : justSaved ? "Saved!" : children}
    </button>
  );
}
