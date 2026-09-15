import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Phase 1: staff only. There is no partner account type yet — every signed-in
 * user is CS/Sales staff, gated to the deeptech.build Google Workspace.
 * Phase 2 adds a second, magic-link provider for partners.
 */
const staffDomain = process.env.STAFF_EMAIL_DOMAIN;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js validates the request Host header against a trusted list by
  // default and rejects anything else as UntrustedHost. That check assumes
  // a platform like Vercel that sets its own trusted forwarding headers —
  // Fly.io doesn't, so without this every request 500s before auth even
  // runs (confirmed via `fly logs` after the first deploy).
  trustHost: true,
  providers: [
    Google({
      // Restricts the Google account picker to the workspace domain. UX only —
      // the signIn callback below is what actually enforces the restriction.
      authorization: { params: { hd: staffDomain } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async signIn({ profile }) {
      if (!staffDomain) {
        console.error(
          "STAFF_EMAIL_DOMAIN is not configured — denying all sign-ins.",
        );
        return false;
      }
      const hd = (profile as { hd?: string } | undefined)?.hd;
      const email = profile?.email;
      // Check both the Google Workspace `hd` claim and the email suffix: `hd`
      // is the real signal, the suffix check is defense in depth in case a
      // provider profile ever omits it.
      return (
        hd === staffDomain ||
        (typeof email === "string" && email.endsWith(`@${staffDomain}`))
      );
    },
  },
});
