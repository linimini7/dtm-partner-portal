"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PortalSummary } from "@/lib/types";

interface Row extends PortalSummary {
  csLeadName: string;
  salesLeadName: string;
  accessCode: string;
  /** How much of what the partner owes DTM (logo/guidelines, announce, Guardians, named-attendee seats) is actually done — see lib/portal-view.ts's getPartnerObligationProgress. */
  partnerDeliverablesDone: number;
  partnerDeliverablesTotal: number;
}

const COLUMNS = [
  { key: "company", label: "Company", width: 190, min: 110 },
  { key: "code", label: "Access code", width: 130, min: 100 },
  { key: "events", label: "Event(s)", width: 175, min: 80 },
  { key: "csStage", label: "CS stage", width: 130, min: 90 },
  { key: "salesLead", label: "Sales lead", width: 165, min: 90 },
  { key: "contract", label: "Contract", width: 100, min: 80 },
  { key: "deliverables", label: "Deliverables", width: 110, min: 90 },
  { key: "partnerDeliverables", label: "Receivables", width: 170, min: 130 },
  { key: "portalStatus", label: "Portal status", width: 130, min: 90 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

/** Display-only shorthand — Attio's actual Event option is still "SPARTA 2027"; this never touches that data, just how it renders here. */
function eventLabel(event: string): string {
  return event === "SPARTA 2027" ? "SPARTA27" : event;
}

const BOTH_EVENTS_FILTER = "DTM27 & SPARTA 2027";

interface SortKey {
  column: ColumnKey;
  direction: "asc" | "desc";
}

/** One value per column to sort on — nulls always sort last regardless of direction, so an empty field never jumps to the top under desc. */
function sortValue(row: Row, column: ColumnKey): string | number | null {
  switch (column) {
    case "company":
      return row.companyName;
    case "code":
      return row.accessCode;
    case "events":
      return row.events.map(eventLabel).join(", ");
    case "csStage":
      return row.csStage;
    case "salesLead":
      return row.salesLeadName || null;
    // Sorted by the actual signed date, not just whether a contract is on
    // file — matches "second by when the contract is signed" directly.
    case "contract":
      return row.contractSignedDate;
    case "deliverables":
      return row.deliverablesTotal > 0 ? row.deliverablesDone / row.deliverablesTotal : null;
    case "partnerDeliverables":
      return row.partnerDeliverablesTotal > 0
        ? row.partnerDeliverablesDone / row.partnerDeliverablesTotal
        : null;
    case "portalStatus":
      return row.onboardingStage;
    default:
      return null;
  }
}

function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function sortRows(rows: Row[], sortKeys: SortKey[]): Row[] {
  if (sortKeys.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { column, direction } of sortKeys) {
      const cmp = compareSortValues(sortValue(a, column), sortValue(b, column));
      if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

/** Every filterable field, Attio-style — pick a field, pick a value, add as many rules as you want, all AND'd together. Free-text company search stays a separate always-visible box rather than becoming a rule type, since it's the single most common action here. */
type FilterField = "event" | "csStage" | "salesLead" | "contract" | "portalStatus";

interface FilterRule {
  field: FilterField;
  /** Empty until a value is picked — an incomplete rule matches everything rather than hiding all rows while it's being set up. */
  value: string;
}

const FILTER_FIELD_LABELS: Record<FilterField, string> = {
  event: "Event",
  csStage: "CS stage",
  salesLead: "Sales lead",
  contract: "Contract",
  portalStatus: "Portal status",
};

function matchesFilterRule(row: Row, rule: FilterRule): boolean {
  if (!rule.value) return true;
  switch (rule.field) {
    case "event":
      if (rule.value === BOTH_EVENTS_FILTER) {
        return row.events.includes("DTM27" as never) && row.events.includes("SPARTA 2027" as never);
      }
      return row.events.includes(rule.value as never);
    case "csStage":
      return row.csStage === rule.value;
    case "salesLead":
      return row.salesLeadName === rule.value;
    case "contract":
      return rule.value === "On file" ? row.hasContract : !row.hasContract;
    case "portalStatus":
      return rule.value === "Live" ? row.onboardingStage === "Portal live" : row.onboardingStage !== "Portal live";
  }
}

/** Closes a popover on an outside click — plain addEventListener rather than a UI library, since nothing else in this app uses one. */
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside, active]);
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-[var(--radius-chip)] border border-dtm-hairline bg-dtm-ink px-2 py-1 text-xs"
      title="Copy access code"
    >
      {copied ? "Copied!" : code}
    </button>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "alert" | "neutral" }) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "alert"
          ? "var(--alert)"
          : "var(--fg-3)";
  return (
    <span
      className="rounded-[var(--radius-tag)] border px-2 py-0.5 text-xs whitespace-nowrap"
      style={{ borderColor: color, color }}
    >
      {label}
    </span>
  );
}

/** Drag handle on a header cell's right edge — lets staff resize a column instead of living with a fixed width (long legal-entity names like "BLOMSTEIN Partnerschaft von Rechtsanwälten mbB" would otherwise blow the table out). */
function ColumnResizeHandle({
  columnKey,
  widths,
  setWidths,
}: {
  columnKey: ColumnKey;
  widths: Record<ColumnKey, number>;
  setWidths: React.Dispatch<React.SetStateAction<Record<ColumnKey, number>>>;
}) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[columnKey];
    const min = COLUMNS.find((c) => c.key === columnKey)!.min;
    document.body.style.cursor = "col-resize";

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.max(min, startWidth + (ev.clientX - startX));
      setWidths((w) => ({ ...w, [columnKey]: next }));
    };
    const onMouseUp = () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      // A wider invisible hit area than the visible line itself (centered on
      // the column edge via -right-1.5) — the thin 6px line alone was fiddly
      // to grab precisely.
      className="group absolute top-0 -right-1.5 z-10 h-full w-3.5 cursor-col-resize select-none"
    >
      <div className="mx-auto h-full w-[3px] group-hover:bg-dtm-hairline-2 group-active:bg-fg-accent" />
    </div>
  );
}

export default function PortalsTable({ rows, staffEmail }: { rows: Row[]; staffEmail?: string | null }) {
  const [search, setSearch] = useState("");
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])) as Record<ColumnKey, number>,
  );
  const [widthsHydrated, setWidthsHydrated] = useState(false);
  const widthsStorageKey = `portals-table-widths:${staffEmail ?? "anonymous"}`;

  useEffect(() => {
    // Same hydrate-after-mount exception as the sort effect below — column
    // widths dragged to a comfortable size shouldn't reset on every reload.
    try {
      const saved = window.localStorage.getItem(widthsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<ColumnKey, number>>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWidths((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore a missing/corrupt value — falls back to the defaults.
    }
    setWidthsHydrated(true);
  }, [widthsStorageKey]);

  useEffect(() => {
    if (!widthsHydrated) return;
    try {
      window.localStorage.setItem(widthsStorageKey, JSON.stringify(widths));
    } catch {
      // Private-browsing or storage-disabled — resizing still works, it just won't persist.
    }
  }, [widths, widthsStorageKey, widthsHydrated]);

  // Plain click sets a column as the sole sort; shift-click adds it as the
  // next tiebreaker instead, so staff can build "name, then contract date,
  // then ..." themselves. Persisted per signed-in staff member (via
  // localStorage) so it doesn't reset on every page load.
  const sortStorageKey = `portals-table-sort:${staffEmail ?? "anonymous"}`;
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);
  const [sortHydrated, setSortHydrated] = useState(false);

  useEffect(() => {
    // Reading persisted UI state from localStorage after mount (SSR has no
    // access to it, so this can't be a lazy useState initializer without
    // risking a hydration mismatch) — a deliberate, narrow exception to the
    // usual "don't setState in an effect" rule.
    try {
      const saved = window.localStorage.getItem(sortStorageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSortKeys(JSON.parse(saved));
    } catch {
      // Ignore a missing/corrupt value — falls back to unsorted.
    }
    setSortHydrated(true);
  }, [sortStorageKey]);

  useEffect(() => {
    if (!sortHydrated) return;
    try {
      window.localStorage.setItem(sortStorageKey, JSON.stringify(sortKeys));
    } catch {
      // Private-browsing or storage-disabled — sorting still works, it just won't persist.
    }
  }, [sortKeys, sortStorageKey, sortHydrated]);

  // Same persist-after-hydrate pattern as sort above.
  const filterStorageKey = `portals-table-filters:${staffEmail ?? "anonymous"}`;
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [filterHydrated, setFilterHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(filterStorageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFilterRules(JSON.parse(saved));
    } catch {
      // Ignore a missing/corrupt value — falls back to unfiltered.
    }
    setFilterHydrated(true);
  }, [filterStorageKey]);

  useEffect(() => {
    if (!filterHydrated) return;
    try {
      window.localStorage.setItem(filterStorageKey, JSON.stringify(filterRules));
    } catch {
      // Private-browsing or storage-disabled — filtering still works, it just won't persist.
    }
  }, [filterRules, filterStorageKey, filterHydrated]);

  const [sortOpen, setSortOpen] = useState(false);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  useOutsideClick(sortPopoverRef, () => setSortOpen(false), sortOpen);

  const [filterOpen, setFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  useOutsideClick(filterPopoverRef, () => setFilterOpen(false), filterOpen);

  function addSort() {
    setSortKeys((prev) => {
      const used = new Set(prev.map((k) => k.column));
      const next = COLUMNS.find((c) => !used.has(c.key));
      return next ? [...prev, { column: next.key, direction: "asc" as const }] : prev;
    });
  }
  function updateSortColumn(index: number, column: ColumnKey) {
    setSortKeys((prev) => prev.map((k, i) => (i === index ? { ...k, column } : k)));
  }
  function updateSortDirection(index: number, direction: "asc" | "desc") {
    setSortKeys((prev) => prev.map((k, i) => (i === index ? { ...k, direction } : k)));
  }
  function removeSortAt(index: number) {
    setSortKeys((prev) => prev.filter((_, i) => i !== index));
  }

  function addFilter() {
    setFilterRules((prev) => [...prev, { field: "event", value: "" }]);
  }
  function updateFilterField(index: number, field: FilterField) {
    setFilterRules((prev) => prev.map((r, i) => (i === index ? { field, value: "" } : r)));
  }
  function updateFilterValue(index: number, value: string) {
    setFilterRules((prev) => prev.map((r, i) => (i === index ? { ...r, value } : r)));
  }
  function removeFilterAt(index: number) {
    setFilterRules((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleSort(column: ColumnKey, additive: boolean) {
    setSortKeys((prev) => {
      const existing = prev.find((k) => k.column === column);
      if (!additive) {
        // Plain click: if this was already the only sort, just flip its
        // direction; otherwise make it the sole (primary) sort.
        if (prev.length === 1 && existing) {
          return [{ column, direction: existing.direction === "asc" ? "desc" : "asc" }];
        }
        return [{ column, direction: "asc" }];
      }
      // Shift-click: toggle this column's direction in place, or append it
      // as the next tiebreaker if it isn't part of the sort yet.
      if (existing) {
        return prev.map((k) =>
          k.column === column ? { column, direction: k.direction === "asc" ? "desc" : "asc" } : k,
        );
      }
      return [...prev, { column, direction: "asc" }];
    });
  }

  const events = useMemo(() => {
    const individual = Array.from(new Set(rows.flatMap((r) => r.events))).sort();
    const hasBoth = rows.some(
      (r) => r.events.includes("DTM27" as never) && r.events.includes("SPARTA 2027" as never),
    );
    return hasBoth ? [...individual, BOTH_EVENTS_FILTER] : individual;
  }, [rows]);
  const stages = useMemo(
    () => Array.from(new Set(rows.map((r) => r.csStage).filter(Boolean))) as string[],
    [rows],
  );
  const salesLeads = useMemo(
    () => Array.from(new Set(rows.map((r) => r.salesLeadName).filter(Boolean))).sort(),
    [rows],
  );

  function filterFieldOptions(field: FilterField): { value: string; label: string }[] {
    switch (field) {
      case "event":
        return events.map((e) => ({ value: e, label: e === BOTH_EVENTS_FILTER ? "DTM27 & SPARTA27" : eventLabel(e) }));
      case "csStage":
        return stages.map((s) => ({ value: s, label: s }));
      case "salesLead":
        return salesLeads.map((s) => ({ value: s, label: s }));
      case "contract":
        return [
          { value: "On file", label: "On file" },
          { value: "Missing", label: "Missing" },
        ];
      case "portalStatus":
        return [
          { value: "Live", label: "Live" },
          { value: "Draft", label: "Draft" },
        ];
    }
  }

  const filtered = rows.filter((r) => {
    if (search && !r.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    return filterRules.every((rule) => matchesFilterRule(r, rule));
  });

  const sorted = sortRows(filtered, sortKeys);

  const live = rows.filter((r) => r.onboardingStage === "Portal live").length;
  const draft = rows.length - live;
  const overdueTotal = rows.reduce((sum, r) => sum + r.overdueCount, 0);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Counter label="Portals live" value={live} />
        <Counter label="Portals in draft" value={draft} />
        <Counter label="Never opened" value="—" note="Phase 2" />
        <Counter label="Deliverables overdue" value={overdueTotal} tone={overdueTotal > 0 ? "alert" : "ok"} />
      </div>

      <div className="mb-4 flex flex-wrap items-start gap-3">
        <input
          type="text"
          placeholder="Search company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-[var(--radius-panel)] border border-dtm-hairline bg-dtm-surface px-3 py-2 text-fg-1 placeholder:text-fg-4"
        />

        <div className="relative" ref={sortPopoverRef}>
          <button
            type="button"
            onClick={() => {
              setSortOpen((v) => !v);
              setFilterOpen(false);
            }}
            className="rounded-[var(--radius-panel)] border px-3 py-2 text-sm"
            style={{
              borderColor: sortOpen || sortKeys.length > 0 ? "var(--fg-accent)" : "var(--dtm-hairline)",
              color: sortKeys.length > 0 ? "var(--fg-1)" : "var(--fg-3)",
            }}
          >
            {sortKeys.length === 0
              ? "Sort"
              : `Sorted by ${COLUMNS.find((c) => c.key === sortKeys[0].column)?.label}${
                  sortKeys.length > 1 ? ` +${sortKeys.length - 1}` : ""
                }`}
          </button>
          {sortOpen && (
            <div className="absolute z-20 mt-2 w-[380px] rounded-[var(--radius-panel)] border border-dtm-hairline-2 bg-dtm-surface p-3 shadow-lg">
              <div className="flex flex-col gap-2">
                {sortKeys.length === 0 && <p className="text-xs text-fg-5">No sort applied yet.</p>}
                {sortKeys.map((key, i) => {
                  const used = sortKeys.map((k) => k.column);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 text-[10px] text-fg-5">{i + 1}</span>
                      <select
                        value={key.column}
                        onChange={(e) => updateSortColumn(i, e.target.value as ColumnKey)}
                        className="min-w-0 flex-1 rounded-[var(--radius-chip)] border border-dtm-hairline-2 bg-dtm-ink px-2 py-1.5 text-sm text-fg-1"
                      >
                        {COLUMNS.filter((c) => c.key === key.column || !used.includes(c.key)).map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={key.direction}
                        onChange={(e) => updateSortDirection(i, e.target.value as "asc" | "desc")}
                        className="shrink-0 rounded-[var(--radius-chip)] border border-dtm-hairline-2 bg-dtm-ink px-2 py-1.5 text-sm text-fg-1"
                      >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeSortAt(i)}
                        aria-label="Remove sort"
                        className="shrink-0 px-1 text-fg-5 hover:text-fg-1"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={addSort}
                  disabled={sortKeys.length >= COLUMNS.length}
                  className="text-sm font-medium disabled:opacity-40"
                  style={{ color: "var(--accent)" }}
                >
                  + Add sort
                </button>
                {sortKeys.length > 0 && (
                  <button type="button" onClick={() => setSortKeys([])} className="text-xs text-fg-5">
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={filterPopoverRef}>
          <button
            type="button"
            onClick={() => {
              setFilterOpen((v) => !v);
              setSortOpen(false);
            }}
            className="rounded-[var(--radius-panel)] border px-3 py-2 text-sm"
            style={{
              borderColor: filterOpen || filterRules.length > 0 ? "var(--fg-accent)" : "var(--dtm-hairline)",
              color: filterRules.length > 0 ? "var(--fg-1)" : "var(--fg-3)",
            }}
          >
            {filterRules.length === 0
              ? "Filter"
              : `Filtered by ${FILTER_FIELD_LABELS[filterRules[0].field]}${
                  filterRules.length > 1 ? ` +${filterRules.length - 1}` : ""
                }`}
          </button>
          {filterOpen && (
            <div className="absolute z-20 mt-2 w-[420px] rounded-[var(--radius-panel)] border border-dtm-hairline-2 bg-dtm-surface p-3 shadow-lg">
              <div className="flex flex-col gap-2">
                {filterRules.length === 0 && <p className="text-xs text-fg-5">No filters applied yet.</p>}
                {filterRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={rule.field}
                      onChange={(e) => updateFilterField(i, e.target.value as FilterField)}
                      className="min-w-0 flex-[0_0_120px] rounded-[var(--radius-chip)] border border-dtm-hairline-2 bg-dtm-ink px-2 py-1.5 text-sm text-fg-1"
                    >
                      {(Object.keys(FILTER_FIELD_LABELS) as FilterField[]).map((f) => (
                        <option key={f} value={f}>
                          {FILTER_FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                    <span className="shrink-0 text-xs text-fg-5">is</span>
                    <select
                      value={rule.value}
                      onChange={(e) => updateFilterValue(i, e.target.value)}
                      className="min-w-0 flex-1 rounded-[var(--radius-chip)] border border-dtm-hairline-2 bg-dtm-ink px-2 py-1.5 text-sm text-fg-1"
                    >
                      <option value="">Select…</option>
                      {filterFieldOptions(rule.field).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFilterAt(i)}
                      aria-label="Remove filter"
                      className="shrink-0 px-1 text-fg-5 hover:text-fg-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={addFilter}
                  className="text-sm font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  + Add filter
                </button>
                {filterRules.length > 0 && (
                  <button type="button" onClick={() => setFilterRules([])} className="text-xs text-fg-5">
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setWidths(Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])) as Record<ColumnKey, number>)
          }
          className="rounded-[var(--radius-panel)] border border-dtm-hairline px-3 py-2 text-sm text-fg-3"
        >
          Reset column widths
        </button>
      </div>
      <div className="mb-4 -mt-2 text-xs text-fg-5">
        Click a column to sort by it · shift-click another to add it as a tiebreaker, or use the Sort button
        for several rules at once. Use Filter to narrow by more than one field. Drag a column&apos;s right
        edge to resize it. All three are remembered next time you open this page.
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-dtm-hairline">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-dtm-hairline text-fg-3">
              {COLUMNS.map((c) => {
                const sortIndex = sortKeys.findIndex((k) => k.column === c.key);
                const active = sortIndex !== -1 ? sortKeys[sortIndex] : null;
                return (
                  <th key={c.key} className="relative overflow-hidden px-3 py-2 font-normal">
                    <button
                      type="button"
                      title={
                        sortKeys.length > 0
                          ? `Click to sort by ${c.label} · shift-click to add as a tiebreaker`
                          : `Sort by ${c.label}`
                      }
                      onClick={(e) => toggleSort(c.key, e.shiftKey)}
                      className="flex w-full items-center gap-1 truncate whitespace-nowrap text-left"
                    >
                      <span className="truncate">{c.label}</span>
                      {active && (
                        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-fg-4">
                          {sortKeys.length > 1 && <span>{sortIndex + 1}</span>}
                          <span>{active.direction === "asc" ? "▲" : "▼"}</span>
                        </span>
                      )}
                    </button>
                    <ColumnResizeHandle columnKey={c.key} widths={widths} setWidths={setWidths} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.slug} className="border-b border-dtm-hairline last:border-0">
                <td className="overflow-hidden px-3 py-2">
                  <Link href={`/p/${r.slug}`} className="block truncate text-fg-accent" title={r.companyName}>
                    {r.companyName}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <CopyCode code={r.accessCode} />
                </td>
                <td
                  className="overflow-hidden truncate px-3 py-2"
                  title={r.events.map(eventLabel).join(", ")}
                >
                  {r.events.map(eventLabel).join(", ")}
                </td>
                <td className="overflow-hidden truncate px-3 py-2">{r.csStage ?? "—"}</td>
                <td className="overflow-hidden truncate px-3 py-2" title={r.salesLeadName || undefined}>
                  {r.salesLeadName || "—"}
                </td>
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  style={{ color: r.hasContract ? "var(--fg-1)" : "#dc2626" }}
                >
                  {r.hasContract ? "On file" : "Missing"}
                </td>
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  style={r.deliverablesTotal === 0 ? { color: "var(--alert)" } : undefined}
                >
                  {r.deliverablesDone}/{r.deliverablesTotal}
                  {r.overdueCount > 0 && (
                    <span className="ml-1">
                      <StatusPill label={`${r.overdueCount} overdue`} tone="alert" />
                    </span>
                  )}
                </td>
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  style={r.partnerDeliverablesTotal === 0 ? { color: "var(--alert)" } : undefined}
                >
                  {r.partnerDeliverablesDone}/{r.partnerDeliverablesTotal}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.onboardingStage === "Portal live" ? (
                    <StatusPill label="Live" tone="ok" />
                  ) : (
                    <StatusPill label="Draft" tone="neutral" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  note?: string;
  tone?: "ok" | "warn" | "alert" | "neutral";
}) {
  const color =
    tone === "ok" ? "var(--ok)" : tone === "alert" ? "var(--alert)" : "var(--fg-1)";
  return (
    <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-3xl" style={{ color }}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-fg-4">{note}</p>}
    </div>
  );
}

export type { Row };
