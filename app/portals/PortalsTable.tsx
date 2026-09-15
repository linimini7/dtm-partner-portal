"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PortalSummary } from "@/lib/types";

interface Row extends PortalSummary {
  csLeadName: string;
  salesLeadName: string;
  accessCode: string;
}

const COLUMNS = [
  { key: "company", label: "Company", width: 190, min: 110 },
  { key: "code", label: "Access code", width: 130, min: 100 },
  { key: "events", label: "Event(s)", width: 175, min: 80 },
  { key: "csStage", label: "CS stage", width: 130, min: 90 },
  { key: "salesLead", label: "Sales lead", width: 165, min: 90 },
  { key: "contract", label: "Contract", width: 100, min: 80 },
  { key: "deliverables", label: "Deliverables", width: 110, min: 90 },
  { key: "nextDeadline", label: "Next deadline", width: 150, min: 110 },
  { key: "portalStatus", label: "Portal status", width: 130, min: 90 },
  { key: "lastView", label: "Last partner view", width: 150, min: 120 },
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
    case "nextDeadline":
      return row.nextDeadline;
    case "portalStatus":
      return row.onboardingStage;
    case "lastView":
      // Not tracked yet — every row is equal, so this is a no-op until real data exists.
      return null;
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
      className="rounded-[var(--radius-chip)] border border-dtm-hairline bg-dtm-ink px-2 py-1 font-mono text-xs"
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
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none hover:bg-dtm-hairline-2"
    />
  );
}

export default function PortalsTable({ rows, staffEmail }: { rows: Row[]; staffEmail?: string | null }) {
  const [search, setSearch] = useState("");
  const [event, setEvent] = useState("all");
  const [csStage, setCsStage] = useState("all");
  const [salesLead, setSalesLead] = useState("all");
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])) as Record<ColumnKey, number>,
  );

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

  const filtered = rows.filter((r) => {
    if (search && !r.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    if (event === BOTH_EVENTS_FILTER) {
      if (!r.events.includes("DTM27" as never) || !r.events.includes("SPARTA 2027" as never)) return false;
    } else if (event !== "all" && !r.events.includes(event as never)) {
      return false;
    }
    if (csStage !== "all" && r.csStage !== csStage) return false;
    if (salesLead !== "all" && r.salesLeadName !== salesLead) return false;
    return true;
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

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-[var(--radius-panel)] border border-dtm-hairline bg-dtm-surface px-3 py-2 text-fg-1 placeholder:text-fg-4"
        />
        <Select
          label="Event"
          value={event}
          onChange={setEvent}
          options={events}
          formatLabel={(o) => (o === BOTH_EVENTS_FILTER ? "DTM27 & SPARTA27" : eventLabel(o))}
        />
        <Select label="CS stage" value={csStage} onChange={setCsStage} options={stages} />
        <Select label="Sales lead" value={salesLead} onChange={setSalesLead} options={salesLeads} />
        {sortKeys.length > 0 && (
          <button
            type="button"
            onClick={() => setSortKeys([])}
            className="rounded-[var(--radius-panel)] border border-dtm-hairline px-3 py-2 text-sm text-fg-3"
          >
            Clear sort
          </button>
        )}
      </div>
      <div className="mb-4 -mt-2 text-xs text-fg-5">
        Click a column to sort by it · shift-click another to add it as a tiebreaker. Your sort is
        remembered next time you open this page.
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
                        <span className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-fg-4">
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
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.nextDeadline ?? "—"}
                  {r.overdueCount > 0 && (
                    <span className="ml-1">
                      <StatusPill label={`${r.overdueCount} overdue`} tone="alert" />
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.onboardingStage === "Portal live" ? (
                    <StatusPill label="Live" tone="ok" />
                  ) : (
                    <StatusPill label="Draft" tone="neutral" />
                  )}
                </td>
                <td className="overflow-hidden truncate px-3 py-2 text-fg-4">Not tracked yet</td>
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
      <p className="mt-1 text-3xl font-mono" style={{ color }}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-fg-4">{note}</p>}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  formatLabel = (o) => o,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  formatLabel?: (option: string) => string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[var(--radius-panel)] border border-dtm-hairline bg-dtm-surface px-3 py-2 text-fg-1"
    >
      <option value="all">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {formatLabel(o)}
        </option>
      ))}
    </select>
  );
}

export type { Row };
