"use client";

import { useState } from "react";
import { requestMoatStudioIntro } from "./brand-actions";

/**
 * "Connect me with Moat Studio" as a real form rather than a single button
 * — a stray click firing an email off to a real outside vendor is worse
 * than a partner having to type a couple of fields, so submitting requires
 * a name, email, and an actual description of what they want.
 */
export default function MoatIntroForm({
  slug,
  initialName,
  initialEmail,
}: {
  slug: string;
  initialName: string;
  initialEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [request, setRequest] = useState("");
  const [wishes, setWishes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim() && email.trim() && request.trim();

  async function handleSubmit() {
    if (!canSubmit) return;
    setSending(true);
    try {
      await requestMoatStudioIntro(slug, { name, email, request, wishes });
      setSent(true);
      setOpen(false);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="self-start font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "var(--fg-4)" }}>
        Request sent — we&apos;ll connect you shortly ✓
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-mono text-[11px] tracking-[0.1em] uppercase"
        style={{ color: "var(--accent)" }}
      >
        Connect me with Moat Studio →
      </button>
    );
  }

  return (
    <div className="mt-1 flex w-full max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
          style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="flex-1 rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
          style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
        />
      </div>
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="What would you like from Moat Studio? (e.g. help designing our booth backwall)"
        rows={2}
        className="rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
        style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
      />
      <textarea
        value={wishes}
        onChange={(e) => setWishes(e.target.value)}
        placeholder="Anything else they should know? (optional)"
        rows={2}
        className="rounded-[8px] border px-3 py-1.5 text-sm text-fg-1 placeholder:text-fg-5"
        style={{ background: "var(--dtm-ink-2)", borderColor: "var(--dtm-hairline-2)" }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || !canSubmit}
          className="rounded-[8px] px-3 py-1.5 text-sm font-medium disabled:opacity-70"
          style={{ background: "var(--accent)", color: "var(--dtm-ink)" }}
        >
          {sending ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={sending} className="text-sm text-fg-5">
          Cancel
        </button>
      </div>
    </div>
  );
}
