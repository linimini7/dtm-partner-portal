"use client";

import { useMemo, useState } from "react";
import { updateDeliverableStatus } from "./actions";
import type { DtmDeliverableStatus } from "@/lib/dtm-deliverable-status";
import type { DtmDeliverableEvent } from "@/lib/dtm-deliverables";

export interface TrackerDeliverable {
  id: string;
  milestone: string;
  detail: string;
  event: DtmDeliverableEvent;
  workstream: string;
  ownerRole: string;
  date: string;
  hardWall: boolean;
  status: DtmDeliverableStatus;
}

export interface WorkstreamCard {
  workstream: string;
  inScope: boolean;
  total: number;
  done: number;
  nextDue: string | null;
}

const STATUS_LABEL: Record<DtmDeliverableStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting_on_partner: "Waiting on partner",
  done: "Done",
};

const STATUS_COLOR: Record<DtmDeliverableStatus, string> = {
  not_started: "var(--fg-5)",
  in_progress: "var(--cyan)",
  waiting_on_partner: "var(--warn)",
  done: "var(--ok)",
};

const WORKSTREAM_COLORS = ["var(--accent)", "var(--violet-400)", "var(--cyan)", "var(--ok)", "var(--warn)"];

function workstreamColor(workstream: string, order: string[]): string {
  const i = order.indexOf(workstream);
  return WORKSTREAM_COLORS[(i < 0 ? 0 : i) % WORKSTREAM_COLORS.length];
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

function eventDotColor(event: DtmDeliverableEvent): string {
  if (event === "SPARTA27") return "#7A5CF0";
  if (event === "DTM27") return "#D4367A";
  return "var(--fg-4)";
}

/**
 * DTM-internal deliverable tracker for one partner — the write side of
 * lib/dtm-deliverables.ts (Notion-sourced, read-only) joined with persisted
 * per-partner status (lib/dtm-deliverable-status.ts). Never rendered on the
 * partner-facing portal — see ../deliverables/page.tsx's auth gate and the
 * banner above this component.
 */
export default function DeliverablesTracker({
  slug,
  workstreamOrder,
  workstreamCards,
  deliverables,
}: {
  slug: string;
  workstreamOrder: string[];
  workstreamCards: WorkstreamCard[];
  deliverables: TrackerDeliverable[];
}) {
  const [rows, setRows] = useState(deliverables);
  const [filter, setFilter] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: DtmDeliverableStatus) {
    setPendingId(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await updateDeliverableStatus(slug, id, status);
    } finally {
      setPendingId(null);
    }
  }

  const filtered = useMemo(() => {
    const list = filter ? rows.filter((r) => r.workstream === filter) : rows;
    return [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [rows, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] text-fg-1">Your workstream</h2>
          <p className="text-[12px] text-fg-5">
            Pick your team to filter the whole page. Greyed workstreams are not part of this
            partnership.
          </p>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {workstreamCards.map((card) => {
            const color = workstreamColor(card.workstream, workstreamOrder);
            const active = filter === card.workstream;
            return (
              <button
                key={card.workstream}
                type="button"
                disabled={!card.inScope}
                onClick={() => setFilter(active ? null : card.workstream)}
                className="rounded-[var(--radius-card)] border p-4 text-left transition-opacity"
                style={{
                  borderColor: active ? color : "var(--dtm-hairline)",
                  background: "var(--dtm-surface)",
                  opacity: card.inScope ? 1 : 0.45,
                  cursor: card.inScope ? "pointer" : "not-allowed",
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-fg-1">{card.workstream}</span>
                  <span
                    className="rounded-[var(--radius-tag)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                    style={{
                      color: card.inScope ? color : "var(--fg-5)",
                      background: card.inScope ? `${color}22` : "var(--dtm-ink-2)",
                    }}
                  >
                    {card.inScope ? "In scope" : "Not in scope"}
                  </span>
                </div>
                {card.inScope ? (
                  <>
                    <p className="mb-2 text-[11.5px] text-fg-4">{card.workstream} Owner</p>
                    <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--dtm-ink-2)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${card.total ? (card.done / card.total) * 100 : 0}%`, background: color }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-fg-5">
                      <span>
                        {card.done} / {card.total} done
                      </span>
                      {card.nextDue && (
                        <span style={{ color: "var(--warn)" }}>Next {formatShort(card.nextDue)}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[11.5px] text-fg-5">No deliverables for this partner</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] text-fg-1">All DTM-side deliverables</h2>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-fg-5">{filtered.length} deliverables</span>
            {filter && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="rounded-[var(--radius-chip)] border border-dtm-hairline-2 px-2.5 py-1 text-[11px] text-fg-3"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-dtm-hairline">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-dtm-hairline" style={{ background: "var(--dtm-surface-2)" }}>
                <th className="eyebrow px-4 py-2.5 font-normal">Deliverable</th>
                <th className="eyebrow px-4 py-2.5 font-normal">Workstream</th>
                <th className="eyebrow px-4 py-2.5 font-normal">DTM owner</th>
                <th className="eyebrow px-4 py-2.5 font-normal">Due</th>
                <th className="eyebrow px-4 py-2.5 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const color = workstreamColor(row.workstream, workstreamOrder);
                return (
                  <tr key={row.id} className="border-b border-dtm-hairline last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: eventDotColor(row.event) }}
                          title={row.event}
                        />
                        <div>
                          <div className="font-medium text-fg-1">{row.milestone}</div>
                          {row.detail && <div className="mt-0.5 max-w-[420px] text-[12px] text-fg-4">{row.detail}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className="rounded-[var(--radius-tag)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]"
                        style={{ color, background: `${color}22` }}
                      >
                        {row.workstream}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-fg-3">{row.ownerRole}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="font-mono" style={{ color: row.hardWall ? "var(--alert)" : "var(--fg-2)" }}>
                        {formatShort(row.date)}
                      </span>
                      {row.hardWall && (
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--alert)" }}>
                          Hard wall
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        value={row.status}
                        disabled={pendingId === row.id}
                        onChange={(e) => handleStatusChange(row.id, e.target.value as DtmDeliverableStatus)}
                        className="rounded-[var(--radius-tag)] border-0 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]"
                        style={{ color: STATUS_COLOR[row.status], background: `${STATUS_COLOR[row.status]}22` }}
                      >
                        {(Object.keys(STATUS_LABEL) as DtmDeliverableStatus[]).map((s) => (
                          <option key={s} value={s} style={{ background: "var(--dtm-surface)", color: "var(--fg-1)" }}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-fg-5">
                    No deliverables match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
