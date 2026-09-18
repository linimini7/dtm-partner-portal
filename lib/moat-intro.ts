/**
 * "Connect me with Moat Studio" — the partner-facing ask on the Moat
 * Studio promo card (see PortalShell.tsx and app/p/[slug]/brand-actions.ts's
 * requestMoatStudioIntro) to be introduced to DTM's design partner. This is
 * just the email content; sending/drafting lives in lib/gmail.ts.
 */

export const MOAT_STUDIO_CONTACTS = ["johanna@moat-studio.com", "emma@moat-studio.com"];

export function buildMoatIntroEmail(params: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  request: string;
  wishes: string;
}): { subject: string; body: string } {
  const { companyName, contactName, contactEmail, request, wishes } = params;
  const subject = `Intro: ${companyName} × Moat Studio`;
  const body = [
    "Hi Johanna and Emma,",
    "",
    `${companyName} is one of our partners at Deep Tech Momentum and would like to connect with you about design and branding support.`,
    "",
    `Looping in ${contactName} (${contactEmail}) from ${companyName} directly — over to you two!`,
    "",
    "What they're looking for:",
    request,
    ...(wishes ? ["", "Anything else to know:", wishes] : []),
    "",
    "Best,",
    "DTM Partnerships Team",
  ].join("\n");
  return { subject, body };
}
