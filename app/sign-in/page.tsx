import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-6">
        <p className="eyebrow mb-2">DTM Partner Portal</p>
        <h1 className="mb-1 text-2xl">Staff sign-in</h1>
        <p className="mb-6 text-fg-3">
          Restricted to @{process.env.STAFF_EMAIL_DOMAIN ?? "deeptech.build"}{" "}
          Google accounts.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/portals" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-[var(--radius-panel)] bg-violet-400 px-4 py-3 font-sans font-bold text-fg-1"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
