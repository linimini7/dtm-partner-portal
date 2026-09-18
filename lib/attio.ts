import { CURRENT_CYCLE_EVENTS } from "@/lib/event-info";
import { derivePartnerObligations } from "@/lib/portal-view";
import { slugify } from "@/lib/slug";
import type {
  Deliverable,
  DeliverableStatus,
  EventName,
  PersonRef,
  PortalDetail,
  PortalSummary,
  PortalVariant,
  StaffMember,
} from "@/lib/types";

/**
 * Real Attio API v2 client. Requires ATTIO_API_KEY — see .env.example.
 *
 * Verified 2026-09-08 against the live workspace with a real key (curl
 * probes against /objects/*, /lists/*, /workspace_members — see git history
 * of this file / the conversation for the exact requests). Two things the
 * MCP Attio connector abstracts away that the raw API does NOT:
 *  - Filter bodies are `{ [attribute_slug]: { target_record_id } }` for a
 *    record-reference equality match, not a generic {attribute, op, value}
 *    shape (that shape belongs to the MCP tool, not the real API — it
 *    returns "Unknown attribute slug: op" if you send it here).
 *  - List entries use `parent_record_id` / `parent_object` as flat top-level
 *    fields (not a nested `parent_record` object) and their attribute
 *    payload is keyed `entry_values`, not `values`.
 *  - `people.name` is a `personal-name` type (`.full_name`, not `.value`)
 *    and `people.email_addresses` is `email-address` type (`.email_address`,
 *    not `.value`) — company `name` and deliverable `notes`/`due_date`/etc.
 *    are plain `text`/`date`/`number`/`select` and do use `.value`/`.option`.
 */

const ATTIO_BASE = "https://api.attio.com/v2";

const COMPANIES_OBJECT = process.env.ATTIO_COMPANIES_OBJECT_ID ?? "companies";
const PEOPLE_OBJECT = process.env.ATTIO_PEOPLE_OBJECT_ID ?? "people";
const DELIVERABLES_OBJECT =
  process.env.ATTIO_DELIVERABLES_OBJECT_ID ?? "deliverables";
const INVENTORY_OBJECT = process.env.ATTIO_INVENTORY_OBJECT_ID ?? "inventory";
const CS_TRACKER_LIST =
  process.env.ATTIO_CS_TRACKER_LIST_ID ?? "customer_success";

async function attioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ATTIO_API_KEY is not configured — lib/data.ts should have used fixtures instead of calling lib/attio.ts directly.",
    );
  }
  const res = await fetch(`${ATTIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    // Brief requires a short TTL with a manual staff refresh, not
    // request-per-render freshness. cache: 'force-cache' is required for
    // Next to cache POST requests and requests with an Authorization header
    // at all — revalidate/tags alone do not opt those in.
    // revalidateTag("attio") is the manual refresh hook.
    cache: "force-cache",
    next: { revalidate: 300, tags: ["attio"] },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Attio API ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---- Attio v2 value-shape helpers -----------------------------------------
// Attio returns every attribute as an array of value-version objects, even
// for single-valued attributes. These helpers pull the parts Phase 1 needs
// and degrade to null/empty rather than throwing, since real CS Tracker data
// is known to have missing POCs, missing contract links, unexploded
// deliverables, etc. — a page should render a gap, not crash on one.
type AttioValues = Record<string, unknown[] | undefined>;

function firstText(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { value?: string } | undefined;
  return v?.value ?? null;
}

function firstDate(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { value?: string } | undefined;
  return v?.value ?? null;
}

function firstNumber(values: AttioValues, slug: string): number | null {
  const v = values[slug]?.[0] as { value?: number } | undefined;
  return v?.value ?? null;
}

function firstStatusTitle(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { status?: { title?: string } } | undefined;
  return v?.status?.title ?? null;
}

function firstSelectTitle(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { option?: { title?: string } } | undefined;
  return v?.option?.title ?? null;
}

function allSelectTitles(values: AttioValues, slug: string): string[] {
  const arr = (values[slug] ?? []) as { option?: { title?: string } }[];
  return arr.map((v) => v.option?.title).filter((t): t is string => !!t);
}

function allDomains(values: AttioValues, slug: string): string[] {
  const arr = (values[slug] ?? []) as { domain?: string }[];
  return arr.map((v) => v.domain).filter((d): d is string => !!d);
}

function firstRecordRef(
  values: AttioValues,
  slug: string,
): { objectSlug: string; recordId: string } | null {
  const v = values[slug]?.[0] as
    | { target_object?: string; target_record_id?: string }
    | undefined;
  if (!v?.target_record_id) return null;
  return { objectSlug: v.target_object ?? "", recordId: v.target_record_id };
}

function firstActorId(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { referenced_actor_id?: string } | undefined;
  return v?.referenced_actor_id ?? null;
}

/** `personal-name` type (people.name) — NOT the same shape as plain text. */
function firstPersonName(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { full_name?: string } | undefined;
  return v?.full_name ?? null;
}

/** `email-address` type (people.email_addresses) — NOT plain text. */
function firstEmail(values: AttioValues, slug: string): string | null {
  const v = values[slug]?.[0] as { email_address?: string } | undefined;
  return v?.email_address ?? null;
}

// ---- Records/entries wire shapes ------------------------------------------

interface AttioRecord {
  id: { record_id: string };
  values: AttioValues;
}

interface AttioListEntry {
  id: { entry_id: string };
  parent_record_id: string;
  parent_object: string;
  entry_values: AttioValues;
}

async function getRecord(object: string, recordId: string): Promise<AttioRecord | null> {
  try {
    const res = await attioFetch<{ data: AttioRecord }>(
      `/objects/${object}/records/${recordId}`,
    );
    return res.data;
  } catch {
    // A dangling reference (e.g. a deleted record) shouldn't take the whole
    // page down — the caller renders a gap instead.
    return null;
  }
}

async function queryRecords(
  object: string,
  body: Record<string, unknown>,
): Promise<AttioRecord[]> {
  const res = await attioFetch<{ data: AttioRecord[] }>(
    `/objects/${object}/records/query`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

async function queryListEntries(
  list: string,
  body: Record<string, unknown>,
): Promise<AttioListEntry[]> {
  const res = await attioFetch<{ data: AttioListEntry[] }>(
    `/lists/${list}/entries/query`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

// ---- Variant / status mapping ----------------------------------------------

function variantFromEvents(events: EventName[]): PortalVariant {
  const hasDtm27 = events.includes("DTM27");
  const hasSparta = events.includes("SPARTA 2027");
  if (hasDtm27 && hasSparta) return "both";
  if (hasDtm27) return "dtm27";
  if (hasSparta) return "sparta27";
  return "unsupported";
}

function toDeliverableStatus(raw: string | null): DeliverableStatus {
  const known: DeliverableStatus[] = [
    "Not started",
    "In progress",
    "Blocked",
    "Done",
    "N/A",
  ];
  return (known as string[]).includes(raw ?? "")
    ? (raw as DeliverableStatus)
    : "Not started";
}

function csEntryToSummary(
  entry: AttioListEntry,
  companyName: string,
): PortalSummary {
  const events = allSelectTitles(entry.entry_values, "event") as EventName[];
  return {
    companyRecordId: entry.parent_record_id,
    companyName,
    slug: slugify(companyName),
    variant: variantFromEvents(events),
    events,
    csStage: firstStatusTitle(entry.entry_values, "stage"),
    onboardingStage: firstStatusTitle(entry.entry_values, "onboarding_stage"),
    health: firstSelectTitle(entry.entry_values, "health"),
    csLeadId: firstActorId(entry.entry_values, "primary_csm"),
    salesLeadId: firstActorId(entry.entry_values, "sales_lead"),
    contractSignedDate: firstDate(entry.entry_values, "contract_signed_date"),
    hasContract: Boolean(firstText(entry.entry_values, "contract_link")),
    invoicingStatus: firstSelectTitle(entry.entry_values, "invoicing_status"),
    // Deliverable rollup counts are filled in by the caller once deliverables
    // are fetched — this function only knows the CS Tracker entry itself.
    deliverablesDone: 0,
    deliverablesTotal: 0,
    overdueCount: 0,
    nextDeadline: null,
    // Filled in by the caller once deliverables are fetched, same as the
    // rollup counts above — derivePartnerObligations needs the real
    // per-company deliverables list to know which named-attendee seats apply.
    partnerObligations: [],
  };
}

/**
 * A company can end up with more than one CS Tracker entry — Attio's own
 * native workflow (fires when a sales-pipeline deal crosses into its
 * closed-won-equivalent stage) and the "Contract → Attio Deliverables" n8n
 * pipeline (fires when a signed contract PDF lands in Drive) each create
 * entries independently, with no check for one already existing. Confirmed
 * live for Bayern Innovativ and Sphere Defense (2026-09-17): a real,
 * contract-backed entry from one path, then a bare duplicate from the
 * other ~a day (or, that day, ~2 minutes) later. Every caller of
 * listCsEntries() wants exactly one entry per company — a partner should
 * never get two rows in the staff table or an arbitrary pick of which
 * entry's data renders their portal — so dedupe here, once, for everyone.
 * Prefer whichever entry actually has a contract on file; between two
 * with (or without) one, prefer the earliest, since the later one is the
 * stray duplicate in every case seen so far.
 */
async function listCsEntries(): Promise<AttioListEntry[]> {
  const entries = await queryListEntries(CS_TRACKER_LIST, {});
  const byCompany = new Map<string, AttioListEntry>();
  for (const entry of entries) {
    const existing = byCompany.get(entry.parent_record_id);
    if (!existing) {
      byCompany.set(entry.parent_record_id, entry);
      continue;
    }
    const existingHasContract = Boolean(firstText(existing.entry_values, "contract_link"));
    const candidateHasContract = Boolean(firstText(entry.entry_values, "contract_link"));
    if (candidateHasContract === existingHasContract) {
      const existingCreated = firstText(existing.entry_values, "created_at");
      const candidateCreated = firstText(entry.entry_values, "created_at");
      if (candidateCreated && existingCreated && new Date(candidateCreated) < new Date(existingCreated)) {
        byCompany.set(entry.parent_record_id, entry);
      }
    } else if (candidateHasContract) {
      byCompany.set(entry.parent_record_id, entry);
    }
  }
  return Array.from(byCompany.values());
}

// ---- Public API -------------------------------------------------------------

/** Every partner's slug plus their company's Attio Domains — used only to match an inbound email's sender domain to a partner (see lib/email-ingestion.ts). */
export async function listPartnerDomains(): Promise<{ slug: string; companyName: string; domains: string[] }[]> {
  const entries = await listCsEntries();
  const companies = await Promise.all(
    entries.map((e) => getRecord(COMPANIES_OBJECT, e.parent_record_id)),
  );
  return entries.map((_, i) => {
    const name = firstText(companies[i]?.values ?? {}, "name") ?? "(unnamed company)";
    return {
      slug: slugify(name),
      companyName: name,
      domains: allDomains(companies[i]?.values ?? {}, "domains"),
    };
  });
}

export async function listPortalCompanies(): Promise<PortalSummary[]> {
  const entries = await listCsEntries();
  const companies = await Promise.all(
    entries.map((e) => getRecord(COMPANIES_OBJECT, e.parent_record_id)),
  );
  const summaries = entries.map((entry, i) => {
    const name =
      firstText(companies[i]?.values ?? {}, "name") ?? "(unnamed company)";
    return csEntryToSummary(entry, name);
  });

  // Fill in deliverable rollups per company.
  return Promise.all(
    summaries.map(async (summary) => {
      const deliverables = await getDeliverablesForCompany(
        summary.companyRecordId,
        summary.events,
      );
      const done = deliverables.filter((d) => d.status === "Done").length;
      const total = deliverables.filter((d) => d.status !== "N/A").length;
      const open = deliverables.filter(
        (d) => d.dueDate && d.status !== "Done" && d.status !== "N/A",
      );
      const today = new Date().toISOString().slice(0, 10);
      const overdueCount = open.filter((d) => d.dueDate! < today).length;
      const upcoming = open.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
      const scopedEvents = summary.events.filter((e) => CURRENT_CYCLE_EVENTS.includes(e));
      return {
        ...summary,
        deliverablesDone: done,
        deliverablesTotal: total,
        overdueCount,
        nextDeadline: upcoming?.dueDate ?? null,
        partnerObligations: derivePartnerObligations(scopedEvents, deliverables),
      };
    }),
  );
}

export async function getDeliverablesForCompany(
  companyRecordId: string,
  events: EventName[],
): Promise<Deliverable[]> {
  // Only this cycle's events — a multi-year deal's DTM28-tagged items belong
  // to a portal that doesn't exist yet, even if the same company also has
  // DTM27 deliverables this cycle (see VUSE XR: a DTM27+DTM28 deal whose
  // DTM28 items are same-named as the DTM27 ones and have no due date yet).
  const scopedEvents = events.filter((e) => CURRENT_CYCLE_EVENTS.includes(e));
  const records = await queryRecords(DELIVERABLES_OBJECT, {
    filter: { company: { target_record_id: companyRecordId } },
  });

  // A deliverable's catalogue_item is sometimes deliberately an inventory
  // "atom" (e.g. "Booth Space — 4x4m") standing in for the real sold bundle
  // (e.g. "4x4m Booth") in source_catalogue_item — done specifically so the
  // INV Apps Script's Sold-count tally never double-counts a bundle
  // alongside its own atom (see the 2026-09-15 self-referencing-bundle
  // fix). That's correct for counting, but Name is a read-only formula off
  // catalogue_item, so it surfaces the atom's name ("Booth Space — 4x4m")
  // everywhere, including to the partner — who never bought bare booth
  // space, only the real "4x4m Booth" package.
  //
  // IMPORTANT: this only applies to the space-atom deliverable itself.
  // Sub-items within that space (Carpet, Furniture, Backwall, ...) also
  // carry a source_catalogue_item, but theirs points at the space atom
  // *they* sit inside, not at the top-level sold bundle — resolving it the
  // same way would wrongly relabel every piece of furniture as "Booth
  // Space — 4x4m" too. Gate on the raw name actually being a bare "Booth
  // Space — ..." atom, not merely on source differing from catalogue_item.
  const BOOTH_SPACE_ATOM = /^Booth Space\b/i;
  const rawNames = records.map((r) => firstText(r.values, "name") ?? "(untitled deliverable)");
  const sourceItems = records.map((r) => firstRecordRef(r.values, "source_catalogue_item"));
  const soldBundleIds = Array.from(
    new Set(
      sourceItems
        .filter((sourceItem, i) => BOOTH_SPACE_ATOM.test(rawNames[i]) && sourceItem)
        .map((sourceItem) => sourceItem!.recordId),
    ),
  );
  const soldBundleNames = new Map<string, string>();
  await Promise.all(
    soldBundleIds.map(async (id) => {
      const rec = await getRecord(INVENTORY_OBJECT, id);
      const name = rec ? firstText(rec.values, "name") : null;
      if (name) soldBundleNames.set(id, name);
    }),
  );

  return records
    .map((r, i): Deliverable => {
      const sourceItem = sourceItems[i];
      const rawName = rawNames[i];
      const soldName =
        BOOTH_SPACE_ATOM.test(rawName) && sourceItem ? soldBundleNames.get(sourceItem.recordId) : undefined;
      return {
        id: r.id.record_id,
        name: soldName ?? rawName,
        workstream: firstSelectTitle(r.values, "workstream") ?? "",
        phase: firstSelectTitle(r.values, "phase") ?? "",
        status: toDeliverableStatus(firstSelectTitle(r.values, "status")),
        dueDate: firstDate(r.values, "due_date"),
        quantity: firstNumber(r.values, "quantity"),
        notes: firstText(r.values, "notes"),
        events: allSelectTitles(r.values, "event") as EventName[],
      };
    })
    // The two known "TEST ROW" records in real data carry status N/A
    // specifically so they can be excluded like this.
    .filter(
      (d) => d.status !== "N/A" && d.events.some((e) => scopedEvents.includes(e)),
    );
}

export async function getStaffDirectory(): Promise<Record<string, StaffMember>> {
  const res = await attioFetch<{
    data: {
      id: { workspace_member_id: string };
      first_name: string;
      last_name: string;
      email_address: string;
    }[];
  }>("/workspace_members");
  return Object.fromEntries(
    res.data.map((m) => [
      m.id.workspace_member_id,
      {
        id: m.id.workspace_member_id,
        name: `${m.first_name} ${m.last_name}`.trim(),
        email: m.email_address,
      },
    ]),
  );
}

export async function getPortalBySlug(slug: string): Promise<PortalDetail | null> {
  const entries = await listCsEntries();
  const companies = await Promise.all(
    entries.map((e) => getRecord(COMPANIES_OBJECT, e.parent_record_id)),
  );
  const index = entries.findIndex((e, i) => {
    const name = firstText(companies[i]?.values ?? {}, "name") ?? "";
    return slugify(name) === slug;
  });
  if (index === -1) return null;

  const entry = entries[index];
  const companyName =
    firstText(companies[index]?.values ?? {}, "name") ?? "(unnamed company)";
  const summary = csEntryToSummary(entry, companyName);
  const deliverables = await getDeliverablesForCompany(
    summary.companyRecordId,
    summary.events,
  );
  const done = deliverables.filter((d) => d.status === "Done").length;
  const total = deliverables.filter((d) => d.status !== "N/A").length;

  let poc: PersonRef | null = null;
  const pocRef = firstRecordRef(entry.entry_values, "poc");
  if (pocRef) {
    const person = await getRecord(pocRef.objectSlug || PEOPLE_OBJECT, pocRef.recordId);
    if (person) {
      poc = {
        recordId: pocRef.recordId,
        name: firstPersonName(person.values, "name") ?? "(unnamed contact)",
        email: firstEmail(person.values, "email_addresses"),
        jobTitle: firstText(person.values, "job_title"),
      };
    }
  }

  return {
    ...summary,
    deliverablesDone: done,
    deliverablesTotal: total,
    contractLink: firstText(entry.entry_values, "contract_link"),
    internalNotes: firstText(entry.entry_values, "notes"),
    poc,
    deliverables,
  };
}
