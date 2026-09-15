import { createHmac, timingSafeEqual } from "crypto";

/**
 * Per-portal access code, so a partner can view their own portal without
 * signing in at all (this app has no partner account model — see the
 * conversation this was built in). Deliberately not a database-backed
 * secret: the code is deterministically derived from the slug plus a
 * server-only secret, so there's nothing to store or rotate per company —
 * only PORTAL_CODE_SECRET itself needs protecting.
 *
 * A code is scoped to exactly one slug (the slug is part of the HMAC
 * input), so knowing one company's code never unlocks another's.
 */

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getPortalCode(slug: string): string {
  const secret = process.env.PORTAL_CODE_SECRET;
  if (!secret) {
    throw new Error("PORTAL_CODE_SECRET is not configured.");
  }
  const raw = createHmac("sha256", secret).update(slug).digest("hex").toUpperCase().slice(0, 8);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function verifyPortalCode(slug: string, submitted: string): boolean {
  const expected = normalize(getPortalCode(slug));
  const given = normalize(submitted);
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(given);
  // Constant-time comparison — this gates access to real partner data, so a
  // naive === would leak how many leading characters matched via timing.
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}
