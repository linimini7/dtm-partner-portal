"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalCode } from "@/lib/portal-code";

export async function submitPortalCode(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const code = String(formData.get("code") ?? "");

  if (!verifyPortalCode(slug, code)) {
    redirect(`/p/${slug}?invalid=1`);
  }

  const cookieStore = await cookies();
  // Scoped to this portal's own path — the browser won't even send this
  // cookie on a request for a different company's /p/{slug}, and the
  // server re-verifies the value against the current slug regardless.
  cookieStore.set(`pa_${slug}`, code, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/p/${slug}`,
    maxAge: 60 * 60 * 24 * 180, // 180 days — partners shouldn't have to re-enter this often
  });
  redirect(`/p/${slug}`);
}
