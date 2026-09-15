import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  // Phase 1 has no partner accounts yet — every signed-in user is staff.
  // Phase 2 will branch here by role once partner magic-link auth exists.
  redirect(session ? "/portals" : "/sign-in");
}
