import { NextResponse } from "next/server";
import { ingestPartnerEmails } from "@/lib/email-ingestion";

/**
 * Triggers a scan of partnerships@deeptech.build for partner logos/contact
 * info. Protected by a shared secret (not staff login) since this is meant
 * to be called by an external scheduler, not a browser session — pass it as
 * either `?secret=` or an `Authorization: Bearer <secret>` header.
 *
 * Accepts both GET and POST — external cron services vary in which one they
 * default to and some don't expose the method as a setting at all, and the
 * real access control here is the secret, not the HTTP verb.
 */
async function handle(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const providedSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestPartnerEmails();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
