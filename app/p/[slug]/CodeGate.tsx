import Image from "next/image";
import { submitPortalCode } from "./actions";

export default function CodeGate({
  slug,
  companyName,
  invalid,
}: {
  slug: string;
  companyName: string;
  invalid: boolean;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--dtm-ink)" }}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <Image
          src="/dtm-logo.png"
          alt="Deep Tech Momentum"
          width={274}
          height={213}
          className="h-11 w-auto mb-4"
        />
        <p className="eyebrow mb-2">{companyName}</p>
        <h1 className="mb-1 text-xl text-fg-1">Enter your access code</h1>
        <p className="mb-6 text-sm text-fg-4">
          Your DTM point of contact sent you a code for this portal.
        </p>
        {invalid && (
          <p className="mb-4 text-sm" style={{ color: "var(--alert)" }}>
            That code didn&apos;t match — check it and try again.
          </p>
        )}
        <form action={submitPortalCode} className="flex flex-col gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input
            type="text"
            name="code"
            placeholder="XXXX-XXXX"
            autoFocus
            className="rounded-[var(--radius-panel)] border border-dtm-hairline bg-dtm-ink-2 px-3 py-2.5 font-mono text-fg-1 placeholder:text-fg-5"
          />
          <button
            type="submit"
            className="rounded-[var(--radius-panel)] px-4 py-2.5 font-sans font-semibold text-fg-1"
            style={{ background: "var(--accent)" }}
          >
            View my portal
          </button>
        </form>
      </div>
    </main>
  );
}
