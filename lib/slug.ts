/**
 * Deterministic slug from a company's canonical Attio name. Exposed as a pure
 * function now so Phase 4's auto-provisioning trigger can reuse the exact same
 * logic later without redefining it — the slug a portal is created under must
 * match the slug this function produces for the same company name, forever.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
