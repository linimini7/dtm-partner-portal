import * as attio from "@/lib/attio";
import * as fixtures from "@/lib/fixtures";

/**
 * Single entry point every page uses to read portal data. Delegates to the
 * real Attio client once ATTIO_API_KEY is configured; until then, falls back
 * to real captured Attio records in lib/fixtures.ts so Phase 1 can be built
 * and verified without a deployed app credential (see the plan's
 * "Prerequisites only the user can provide"). Remove this branch once a real
 * key is in place everywhere this app runs.
 */
const source = process.env.ATTIO_API_KEY ? attio : fixtures;

export const listPortalCompanies = source.listPortalCompanies;
export const getPortalBySlug = source.getPortalBySlug;
export const getStaffDirectory = source.getStaffDirectory;
