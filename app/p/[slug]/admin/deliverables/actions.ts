"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { setDeliverableStatus, type DtmDeliverableStatus } from "@/lib/dtm-deliverable-status";

/**
 * Staff-only — unlike app/p/[slug]/brand-actions.ts, this never accepts a
 * partner's portal access-code cookie. This whole tracker (see
 * ../deliverables/page.tsx) exists specifically because DTM-internal detail
 * must never reach the partner-facing bundle, so the write path holds the
 * same line.
 */
async function requireStaff(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Staff sign-in required.");
  }
  return session.user.email;
}

export async function updateDeliverableStatus(slug: string, deliverableId: string, status: DtmDeliverableStatus) {
  const updatedBy = await requireStaff();
  await setDeliverableStatus(slug, deliverableId, status, updatedBy);
  revalidatePath(`/p/${slug}/admin/deliverables`);
}
