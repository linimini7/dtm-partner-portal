"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { workstreamDisplayName, type PortalView, type TabId } from "@/lib/portal-view";
import type { PortalContentFields } from "@/lib/portal-content";
import { mediaKitEventSlug, type EventMediaKit, type MediaKitEvent } from "@/lib/media-kit";
import type { BrandAssets } from "@/lib/brand-assets";
import type { DtmContact } from "@/lib/dtm-contacts";
import BrandAssetsCard from "./BrandAssetsCard";
import ObligationLinksEditor from "./ObligationLinksEditor";
import NomineeEditor from "./NomineeEditor";
import PartnerContactsCard from "./PartnerContactsCard";
import MoatIntroForm from "./MoatIntroForm";
import { toggleObligationChecked } from "./brand-actions";
import { isNomineeObligation, type Nominee } from "@/lib/obligation-shared";

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface p-[22px] flex flex-col gap-3.5 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function SmallButton({
  children,
  href,
  download,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  download?: boolean;
  onClick?: () => void;
}) {
  const className =
    "rounded-[var(--radius-chip)] border border-dtm-hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-3";
  if (href) {
    return (
      <a href={href} target={download ? undefined : "_blank"} rel="noreferrer" download={download} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <SmallButton
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </SmallButton>
  );
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2027-02-09" -> "9 Feb 2027" — a fixed 3-letter month abbreviation, since Intl's "short" style inconsistently returns "Sept" instead of "Sep" depending on the runtime's ICU data. */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg?: string }) {
  return (
    <span
      className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1 rounded-[var(--radius-chip)] whitespace-nowrap inline-block"
      style={{ color, background: bg ?? `${color}14`, border: `1px solid ${color}33` }}
    >
      {children}
    </span>
  );
}

function KV({
  label,
  values,
  href,
}: {
  label: string;
  values: string[];
  href?: string;
}) {
  return (
    <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-3.5 py-1.5 border-t border-[#17171d] text-[12.5px]">
      <div className="text-fg-4">{label}</div>
      {href ? (
        <div className="text-fg-1">
          <a href={href} target="_blank" rel="noreferrer">
            {values[0]}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-fg-1">
          {values.map((v, i) => (
            <div key={i}>{v}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A read-only checkbox row reflecting real data (no click handler) — used for the "Submit your brand guidelines" sub-checks, which tick themselves rather than being manually toggled. */
function AutoCheckRow({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled
        className="h-4 w-4 shrink-0"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="text-[13px] text-fg-2">{label}</span>
    </label>
  );
}

export default function PortalShell({
  view,
  salesLead,
  partnerContact,
  secondPartnerContact,
  isStaff,
  portalContent,
  mediaKit,
  brandAssets,
  checkedObligationIds,
  announceLinks,
  nomineesByObligation,
  ticketCodes,
  dtmContacts,
  slug,
}: {
  view: PortalView;
  salesLead?: { name: string; email: string };
  /** This partner's own point of contact — from Attio's CS Tracker "poc" field if staff set one, else whoever we've seen emailing in as this partner (see lib/email-ingestion.ts). Shown back to the partner themselves, so no reason to keep it staff-only the way admin/page.tsx does with the Attio source. Phone has no Attio equivalent — always sourced from portal_content (see lib/brand-assets.ts's getPartnerContactPhone). */
  partnerContact?: { name: string | null; email: string | null; phone: string | null } | null;
  /** An optional second contact a partner can nominate themselves — for when the contract signatory isn't who's actually reachable day-to-day. Portal-local only, no Attio equivalent. */
  secondPartnerContact?: { name: string | null; email: string | null; phone: string | null } | null;
  isStaff: boolean;
  portalContent: PortalContentFields;
  mediaKit: Record<MediaKitEvent, EventMediaKit>;
  brandAssets: BrandAssets;
  /** Which Action Items obligations this partner has ticked off themselves — real, persisted state (see lib/obligation-checks.ts), unlike the staff-only Key Dates checklist below. */
  checkedObligationIds: string[];
  /** Evidence links attached to "Publicly announce the partnership" — see ObligationLinksEditor. */
  announceLinks: string[];
  /** Named attendees per "nominate someone" obligation (guardians, programme seats, investor dinner) — see NomineeEditor. */
  nomineesByObligation: Record<string, Nominee[]>;
  /** Redemption code per ticket deliverable id, set by staff on /admin — see lib/ticket-codes.ts. */
  ticketCodes: Record<string, string>;
  /** DTM-side people shown to every partner (name/role/email/phone, plus an optional status like "On maternal leave") — staff-managed on Global portal settings, see lib/dtm-contacts.ts. */
  dtmContacts: DtmContact[];
  slug: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [filter, setFilter] = useState("All");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [obligationChecks, setObligationChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(checkedObligationIds.map((id) => [id, true])),
  );
  const [obligationPending, setObligationPending] = useState<string | null>(null);

  async function handleObligationToggle(obligationId: string, title: string, checked: boolean) {
    setObligationChecks((prev) => ({ ...prev, [obligationId]: checked }));
    setObligationPending(obligationId);
    try {
      await toggleObligationChecked(slug, obligationId, title, checked);
    } finally {
      setObligationPending(null);
    }
  }

  const visibleTabs = view.tabs.filter((t) => !t.staffOnly || isStaff);
  const partnerTabs = visibleTabs.filter((t) => !t.staffOnly);
  const staffTabs = visibleTabs.filter((t) => t.staffOnly);

  const phases = Array.from(new Set(view.deliverableChecklist.map((a) => a.phase)));
  const visibleChecklist =
    filter === "All" ? view.deliverableChecklist : view.deliverableChecklist.filter((a) => a.phase === filter);

  // Real, persisted nominee count (see NomineeEditor) — labeled "nominated"
  // rather than "confirmed" since confirmation happens later, outside the
  // portal, and isn't tracked anywhere yet.
  const guardianNomineeCount = nomineesByObligation["guardians"]?.length ?? 0;
  const GUARDIAN_TARGET = 15;
  const guardianProgressPct = Math.min(100, Math.round((guardianNomineeCount / GUARDIAN_TARGET) * 100));

  // The one scheduled deadline (if any) that's actually about confirming
  // 1:1 meetings for this partner's scoped event(s) — real data, not a
  // fabricated date; the row is simply omitted when none applies.
  const confirmMeetingsDeadline = view.keyDates.find(
    (d) => /confirm/i.test(d.what) && /(1:1|opt-in|meeting)/i.test(d.what),
  );

  return (
    <div
      className="min-h-screen grid text-fg-2"
      style={{ gridTemplateColumns: "250px minmax(0,1fr)", background: "var(--dtm-ink)" }}
    >
      <aside className="border-r border-dtm-hairline p-[26px_18px] flex flex-col gap-[26px] sticky top-0 h-screen box-border overflow-auto">
        <div className="flex flex-col gap-3 px-2">
          {isStaff && (
            <Link
              href="/portals"
              className="font-mono text-[10px] tracking-[0.1em] uppercase"
              style={{ color: "var(--fg-5)" }}
            >
              ← All portals
            </Link>
          )}
          <div className="flex flex-col gap-2">
            <Image src="/dtm-logo.png" alt="Deep Tech Momentum" width={274} height={213} className="h-20 w-auto" />
            <div className="eyebrow">Partnership Portal</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {partnerTabs.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex items-center gap-3 w-full text-left text-[13.5px] font-medium px-2.5 py-2 border-0 rounded-[8px] cursor-pointer"
              style={{
                background: tab === item.id ? "var(--dtm-surface-2)" : "transparent",
                color: tab === item.id ? "var(--fg-1)" : "var(--fg-4)",
              }}
            >
              <span className="font-mono text-[10px] opacity-50 w-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{item.label}</span>
            </button>
          ))}

          {staffTabs.length > 0 && (
            <>
              <div className="my-2 border-t border-dtm-hairline" />
              {staffTabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className="flex items-center gap-3 w-full text-left text-[13.5px] font-medium px-2.5 py-2 border-0 rounded-[8px] cursor-pointer"
                  style={{
                    background: tab === item.id ? "var(--dtm-surface-2)" : "transparent",
                    color: tab === item.id ? "var(--fg-1)" : "var(--fg-4)",
                  }}
                >
                  <span className="font-mono text-[10px] opacity-50 w-4">••</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div
            className="rounded-[10px] p-3.5 flex flex-col gap-3"
            style={{ border: "1px solid var(--dtm-hairline)", background: "var(--dtm-surface)" }}
          >
            <div className="eyebrow">Your DTM team</div>
            {salesLead && (
              <div className="flex flex-col gap-0.5">
                <div className="text-[12.5px] font-medium text-fg-2">{salesLead.name}</div>
                <div className="text-[11px] text-fg-4">Partnership</div>
                <a
                  href={`mailto:${salesLead.email}`}
                  title={salesLead.email}
                  className="block truncate font-mono text-[10px]"
                >
                  {salesLead.email}
                </a>
              </div>
            )}
            {dtmContacts.map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="text-[12.5px] font-medium text-fg-2">{c.name}</div>
                  {c.status && (
                    <span
                      className="rounded-[var(--radius-tag)] border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.06em]"
                      style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                    >
                      {c.status}
                    </span>
                  )}
                </div>
                {c.role && <div className="text-[11px] text-fg-4">{c.role}</div>}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    title={c.email}
                    className="block truncate font-mono text-[10px]"
                  >
                    {c.email}
                  </a>
                )}
                {c.phone && <div className="text-[11px] text-fg-4">{c.phone}</div>}
              </div>
            ))}
            <div className="pt-1.5 text-[11px] text-fg-5" style={{ borderTop: "1px solid var(--dtm-hairline)" }}>
              Anything urgent, call rather than email.
            </div>
          </div>
          <PartnerContactsCard slug={slug} primary={partnerContact ?? null} secondary={secondPartnerContact ?? null} />
        </div>
      </aside>

      <main className="p-[34px_44px_72px] flex flex-col gap-7 min-w-0">
        <header className="flex justify-between items-start gap-6 flex-wrap">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="m-0 text-[27px] font-semibold tracking-[-0.025em] text-fg-1">
                {view.companyName} × Deep Tech Momentum
              </h1>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap text-[13px] text-fg-4">
              <span>
                {view.contractLink
                  ? `Contract signed ${view.contractSignedDate ? formatDate(view.contractSignedDate) : "date not recorded"}`
                  : "No contract on file."}
              </span>
              {view.contractLink && (
                <a
                  href={view.contractLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] tracking-[0.1em] uppercase whitespace-nowrap"
                >
                  View agreement ↗
                </a>
              )}
            </div>
          </div>
          {view.eventSections.length > 0 && (
            <div className="ml-auto flex gap-3 flex-wrap">
              {view.eventSections.map((section) => (
                <div
                  key={section.event}
                  className="rounded-[10px] px-4 py-3 min-w-[150px]"
                  style={{
                    border: `1px solid color-mix(in srgb, ${section.accentVar} 35%, transparent)`,
                    background: `color-mix(in srgb, ${section.accentVar} 8%, var(--dtm-surface))`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: section.accentVar }}
                    />
                    <span
                      className="font-mono text-[10px] tracking-[0.1em] uppercase"
                      style={{ color: section.accentVar }}
                    >
                      {section.eventLabel}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-[26px] font-semibold tracking-[-0.03em] leading-[1.15]"
                      style={{ color: section.accentVar }}
                    >
                      {section.daysAway}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4">
                      days
                    </span>
                  </div>
                  <div className="text-[11.5px] text-fg-4">{section.shortDate}</div>
                </div>
              ))}
            </div>
          )}
        </header>

        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            {view.upcomingActionItems.length > 0 && (
              <div
                className="rounded-[13px] overflow-hidden flex flex-col"
                style={{
                  border: "1px solid rgb(224 163 62 / 30%)",
                  background:
                    "linear-gradient(180deg, rgb(224 163 62 / 8%), rgb(224 163 62 / 2%)), var(--dtm-surface)",
                }}
              >
                <div
                  className="flex justify-between items-center gap-3.5 flex-wrap p-[18px_22px]"
                  style={{ borderBottom: "1px solid rgb(224 163 62 / 18%)" }}
                >
                  <div className="flex flex-col gap-[3px]">
                    <div className="text-[16px] font-semibold tracking-[-0.015em] text-fg-1">
                      What we need from you
                    </div>
                    <div className="text-[12.5px] text-fg-3">
                      {view.upcomingActionItems.length === 1
                        ? "One open item."
                        : `${view.upcomingActionItems.length} open items${
                            view.upcomingActionItems.length > 3 ? ", soonest three below." : "."
                          }`}{" "}
                      The rest of this portal is reference — this part is not.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("actions")}
                    className="shrink-0 rounded-[7px] px-[15px] py-[10px] font-mono text-[10px] tracking-[0.12em] uppercase"
                    style={{ background: "var(--warn)", color: "var(--dtm-ink)" }}
                  >
                    {view.upcomingActionItems.length > 3
                      ? `All ${view.upcomingActionItems.length} items →`
                      : "All action items →"}
                  </button>
                </div>
                <div className="flex flex-col">
                  {view.upcomingActionItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 flex-wrap p-[10px_22px]"
                      style={{ borderBottom: "1px solid var(--dtm-surface-2)" }}
                    >
                      <div className="min-w-0" style={{ flex: "1 1 280px" }}>
                        <div className="text-[13.5px] font-medium text-fg-1">{item.title}</div>
                      </div>
                      <Chip color={item.chipColor} bg={`${item.chipColor}16`}>
                        {item.eventTag}
                      </Chip>
                      <div className="flex flex-col gap-0.5 text-right shrink-0" style={{ minWidth: 92 }}>
                        <div
                          className="font-mono text-[12.5px] font-medium"
                          style={{ color: item.daysAway <= 60 ? "var(--warn)" : "var(--fg-2)" }}
                        >
                          {formatDate(item.date)}
                        </div>
                        <div className="text-[10.5px] text-fg-5">in {item.daysAway} days</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view.eventSections.length === 0 ? (
              <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <Card>
                  <div className="text-[15px] font-semibold text-fg-1">
                    Your partnership at a glance
                  </div>
                  <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                    Deliverables not yet exploded in Attio.
                  </div>
                </Card>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="text-[17px] font-semibold text-fg-1">
                    Your {view.eventSections.length > 1 ? "two events" : "event"}
                  </div>
                  <div className="text-[12.5px] text-fg-4">
                    Generated from your contracted deliverables. If anything here does not match
                    your understanding, tell us straight away.
                  </div>
                </div>
                <div
                  className="grid gap-[18px] items-start"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}
                >
                  {view.eventSections.map((section) => (
                    <div
                      key={section.event}
                      className="rounded-[13px] overflow-hidden flex flex-col"
                      style={{
                        border: `1px solid ${section.accentVar}2E`,
                        background: "var(--dtm-surface)",
                      }}
                    >
                      <div
                        className="flex flex-col gap-3 p-[19px_20px]"
                        style={{
                          background: `linear-gradient(180deg, ${section.accentVar}14, ${section.accentVar}04)`,
                          borderBottom: `1px solid ${section.accentVar}24`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-[2px] min-w-0">
                            <div
                              className="text-[27px] font-bold leading-[1.1] tracking-[-0.035em]"
                              style={{ color: section.accentVar }}
                            >
                              {section.eventLabel}
                            </div>
                            <div className="text-[12.5px] text-fg-2 leading-[1.3]">{section.dateLine}</div>
                            <div className="text-[12px] text-fg-4 leading-[1.3]">{section.location}</div>
                          </div>
                          {section.daysAway !== null && (
                            <div className="flex flex-col gap-[2px] text-right shrink-0">
                              <div
                                className="text-[27px] font-bold leading-[1.1] tracking-[-0.035em]"
                                style={{ color: section.accentVar }}
                              >
                                {section.daysAway}
                              </div>
                              <div className="font-mono text-[9px] uppercase tracking-[0.13em] text-fg-4">
                                Days away
                              </div>
                            </div>
                          )}
                        </div>
                        {section.context && (
                          <div
                            className="text-[12.5px] text-fg-3 leading-[1.55] pt-[11px]"
                            style={{ borderTop: "1px solid var(--dtm-hairline)" }}
                          >
                            {section.context}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-[11px] p-[18px_20px]">
                        <div className="eyebrow">What you get</div>
                        {section.glanceRows.length === 0 ? (
                          <div className="text-[12.5px] text-fg-4">
                            Deliverables not yet exploded in Attio.
                          </div>
                        ) : (
                          section.glanceRows.map((row) => <KV key={row.label} {...row} />)
                        )}
                      </div>
                      <div className="flex flex-col gap-[9px] p-[4px_20px_18px]">
                        <div className="eyebrow">Practical</div>
                        {section.practicalLinks.map((row, j) => (
                          <KV key={row.label + j} {...row} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view.hasGuardian && (
              <>
                <div className="border-t border-dtm-hairline" />
                <div className="flex flex-col gap-[18px]">
                  <div className="text-[17px] font-semibold text-fg-1">
                    Make your experience at DTM count
                  </div>
                  <div
                    className="grid gap-[18px] items-start"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}
                  >
                    <Card
                      style={{
                        border: "1px solid rgb(79 169 122 / 28%)",
                        background: "linear-gradient(180deg, rgb(79 169 122 / 7%), rgb(79 169 122 / 1.5%)), var(--dtm-surface)",
                      }}
                    >
                      <div className="flex justify-between items-start gap-2.5">
                        <div className="text-[16px] font-semibold tracking-[-0.015em] text-fg-1">
                          Become a Guardian Catalyst Partner
                        </div>
                        <Chip color="var(--ok)">Rolling</Chip>
                      </div>
                      <div className="text-[13px] text-fg-3 leading-[1.6]">
                        The Guardians of European Deep Tech is an invite-only cohort of
                        Europe&apos;s most senior corporate innovation leaders. As a partner you
                        can nominate Guardians from your network to join, and Guardians receive a
                        complimentary ticket to DTM.
                      </div>
                      <div
                        className="rounded-[10px] p-4 flex flex-col gap-[13px]"
                        style={{ border: "1px solid #1F1F27", background: "var(--dtm-ink)" }}
                      >
                        <div className="flex justify-between items-baseline gap-2.5">
                          <div className="eyebrow">Nominated Guardians</div>
                          <div className="font-mono text-[13px] text-fg-1">
                            {guardianNomineeCount} <span className="text-[#5A5A66]">/ {GUARDIAN_TARGET}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--dtm-hairline)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${guardianProgressPct}%`, background: "var(--ok)" }}
                          />
                        </div>
                        <div className="text-[12.5px] text-fg-2 leading-[1.55]">
                          At 15 confirmed you unlock{" "}
                          <strong className="text-fg-1">4 curated 1:1 meetings</strong> and branding
                          as a <strong style={{ color: "var(--ok)" }}>Guardian Catalyst Partner</strong>.
                        </div>
                      </div>
                      <div className="text-[12px] text-fg-4 leading-[1.55]">
                        Guardians take time to confirm, so the earlier you nominate the better.
                        Someone from the DTM team will walk you through the programme.
                      </div>
                      <a
                        href="https://www.deeptech.build/guardian-program"
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] tracking-[0.1em] uppercase"
                      >
                        Guardian Program →
                      </a>
                    </Card>

                    {view.hasMeet && (
                      <Card>
                        <div className="flex justify-between items-start gap-2.5">
                          <div className="text-[16px] font-semibold tracking-[-0.015em] text-fg-1">
                            Who do you want to meet{view.eventLabel ? ` at ${view.eventLabel}` : ""}?
                          </div>
                          <Chip color="#7A7A88" bg="#16161C">
                            Form coming soon
                          </Chip>
                        </div>
                        <div className="text-[13px] text-fg-3 leading-[1.6]">
                          We curate meetings around what you tell us. Let us know who you want to
                          meet and what your search fields are.
                        </div>
                        <div>
                          <KV
                            label="Curated 1:1s in your package"
                            values={[view.matchmakingItems.map((d) => d.name).join(", ") || "Not yet exploded in Attio"]}
                          />
                          {confirmMeetingsDeadline && (
                            <KV label="You confirm your picks by" values={[formatDate(confirmMeetingsDeadline.date)]} />
                          )}
                          <KV label="Curation runs" values={["Final two weeks"]} />
                        </div>
                        <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                          In the meantime, reply to your point of contact with the companies,
                          roles and markets you are targeting.
                        </div>
                        <div className="text-xs text-fg-5 leading-[1.55]">
                          Both parties must opt in, so we cannot guarantee a specific meeting
                          takes place. Cancellations and no-shows are replaced.
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </>
            )}

            {!view.hasGuardian && (
              <>
                <div className="border-t border-dtm-hairline" />
                <div className="flex flex-col gap-[18px]">
                  <div className="text-[17px] font-semibold text-fg-1">
                    Make your experience at SPARTA27 count
                  </div>
                  {view.hasMeet ? (
                    <Card
                      className="max-w-[520px]"
                      style={{ border: "1px solid rgb(234 179 8 / 35%)", background: "rgb(234 179 8 / 6%)" }}
                    >
                      <div className="text-[15px] font-semibold text-fg-1">Your 1:1 meetings</div>
                      <div className="text-[13px] text-fg-3 leading-[1.6]">
                        SPARTA runs on 15-minute AI-matched, double opt-in 1:1 meetings. For most
                        partners this is the core of the day.
                      </div>
                      <div className="text-[13px] text-fg-2">
                        Three things decide whether they land well:
                      </div>
                      <ol className="flex flex-col gap-2 pl-4 list-decimal text-[13px] text-fg-3 leading-[1.5]">
                        <li>
                          <strong className="text-fg-1">Complete your platform profile</strong> the
                          moment you get access. It is what the matching runs on.
                        </li>
                        <li>
                          <strong className="text-fg-1">
                            Submit your search preferences before the freeze on 28 January 2027.
                          </strong>{" "}
                          After that, our team curates and preferences are locked.
                        </li>
                        <li>
                          <strong className="text-fg-1">
                            Confirm your scheduled meetings in your calendar by 9 February.
                          </strong>{" "}
                          Unconfirmed slots are reassigned so the room stays full.
                        </li>
                      </ol>
                      <div className="text-xs text-fg-5 leading-[1.55]">
                        Both parties must opt in, so we cannot guarantee a specific meeting takes
                        place. Cancellations and no-shows are replaced.
                      </div>
                    </Card>
                  ) : (
                    <Card className="max-w-[520px]">
                      <div className="text-[15px] font-semibold text-fg-1">
                        Who do you want to meet at SPARTA27?
                      </div>
                      <div className="text-[13px] text-fg-3 leading-[1.6]">
                        The room is armed forces, ministries of defence, procurement agencies,
                        primes, public defence institutions, DefTech and dual-use scaleups, and
                        funds.
                      </div>
                      <div className="text-[13px] text-fg-3 leading-[1.6]">
                        Tell us who you want to meet and what your search fields are, and we will
                        curate around it.
                      </div>
                      <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                        <Chip color="var(--fg-5)" bg="var(--dtm-surface-2)">
                          Preference form coming with your platform access
                        </Chip>{" "}
                        Until then, reply to your point of contact.
                      </div>
                    </Card>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "dates" && isStaff && (
          <div className="flex flex-col gap-[18px]">
            <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface overflow-hidden">
              <div className="grid gap-[18px] p-[13px_20px] border-b border-dtm-hairline eyebrow" style={{ gridTemplateColumns: "minmax(96px,120px) minmax(0,1fr) minmax(120px,190px)" }}>
                <div>Date</div>
                <div>What we need from you</div>
                <div>Workstream</div>
              </div>
              {view.keyDates.length === 0 && (
                <div className="p-5 text-sm text-fg-4">No dated deliverables on file yet.</div>
              )}
              {view.keyDates.map((d, i) => (
                <div
                  key={i}
                  className="grid gap-[18px] p-[15px_20px] border-b items-start"
                  style={{ gridTemplateColumns: "minmax(96px,120px) minmax(0,1fr) minmax(120px,190px)", borderColor: "#17171d" }}
                >
                  <div className="flex flex-col gap-1.5">
                    <div
                      className="font-mono text-[13px]"
                      style={{ color: d.hard ? "var(--alert)" : "var(--fg-2)", fontWeight: d.hard ? 600 : 400 }}
                    >
                      {d.date}
                    </div>
                    {d.hard && <Chip color="var(--alert)">Hard</Chip>}
                  </div>
                  <div
                    className="text-[13.5px] leading-[1.55]"
                    style={{ color: d.hard ? "var(--fg-1)" : "var(--fg-2)", fontWeight: d.hard ? 500 : 400 }}
                  >
                    {d.what}
                  </div>
                  <div className="text-[12.5px] text-fg-4">{workstreamDisplayName(d.workstream)}</div>
                </div>
              ))}
            </div>

            <div className="text-[13px] text-fg-4">
              Every DTM-owed deliverable, not just dated ones. Tick items off as you complete
              them.
            </div>
            <div className="flex gap-2 flex-wrap">
              {["All", ...phases].map((label) => (
                <button
                  key={label}
                  onClick={() => setFilter(label)}
                  className="font-mono text-[10.5px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-[6px] cursor-pointer"
                  style={{
                    border: `1px solid ${filter === label ? "var(--dtm-hairline-2)" : "var(--dtm-hairline)"}`,
                    background: filter === label ? "var(--dtm-surface-2)" : "transparent",
                    color: filter === label ? "var(--fg-1)" : "var(--fg-5)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-[var(--radius-card)] border border-dtm-hairline bg-dtm-surface overflow-hidden">
              <div className="grid gap-4 p-[13px_20px] border-b border-dtm-hairline eyebrow" style={{ gridTemplateColumns: "34px minmax(0,1fr) minmax(72px,90px) minmax(86px,110px)" }}>
                <div></div>
                <div>Deliverable</div>
                <div>Phase</div>
                <div>Due</div>
              </div>
              {visibleChecklist.length === 0 && (
                <div className="p-5 text-sm text-fg-4">Nothing on file yet.</div>
              )}
              {visibleChecklist.map((a) => {
                const isDone = !!done[a.id];
                return (
                  <div
                    key={a.id}
                    className="grid gap-4 p-4 items-center border-b"
                    style={{ gridTemplateColumns: "34px minmax(0,1fr) minmax(72px,90px) minmax(86px,110px)", borderColor: "#17171d" }}
                  >
                    <button
                      onClick={() => setDone((s) => ({ ...s, [a.id]: !s[a.id] }))}
                      className="w-[19px] h-[19px] rounded-[5px] grid place-items-center text-[11px] cursor-pointer p-0"
                      style={{
                        border: `1px solid ${isDone ? "var(--accent)" : "var(--dtm-hairline-2)"}`,
                        background: isDone ? "var(--accent)" : "transparent",
                        color: "var(--dtm-ink)",
                      }}
                    >
                      {isDone ? "✓" : ""}
                    </button>
                    <div
                      className="text-[13.5px]"
                      style={{
                        color: isDone ? "#5a5a66" : "var(--fg-1)",
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {a.title}
                    </div>
                    <div>
                      <Chip color="var(--fg-5)" bg="var(--dtm-surface-2)">
                        {a.phase}
                      </Chip>
                    </div>
                    <div className="font-mono text-xs" style={{ color: isDone ? "#4e4e5a" : "var(--fg-3)" }}>
                      {a.due ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-fg-5">
              Checking items off here is local to your browser for now — it doesn&apos;t save
              anywhere yet.
            </div>
          </div>
        )}


        {tab === "assets" && (() => {
          // Each "Coming your way" item moves out into its own box in the
          // main column the moment it actually has content — the right-hand
          // card only ever lists what's still pending. "Your agenda" isn't
          // wired to any real data yet (that feature doesn't exist), so it
          // stays permanently pending — the card never fully disappears
          // until agenda scheduling actually ships.
          const pendingMediaKitSections = view.eventSections.filter((section) => {
            const kit = mediaKit[section.event as MediaKitEvent];
            return !kit.hasImage && !kit.copy;
          });
          const guidelinesPending = view.hasBooth && !portalContent.exhibitorGuidelinesUrl;
          const platformPending = !portalContent.platformUrl;
          const agendaPending = true;
          const hasPending =
            pendingMediaKitSections.length > 0 || guidelinesPending || platformPending || agendaPending;
          const hasRightColumn = hasPending || view.hasBooth;

          return (
          <div
            className="grid gap-[18px] items-start"
            style={{ gridTemplateColumns: hasRightColumn ? "minmax(0, 1.6fr) minmax(280px, 1fr)" : "1fr" }}
          >
            <div className="flex flex-col gap-[18px] min-w-0">
              <Card>
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <div className="text-[15px] font-semibold text-fg-1">
                      Redeem your included tickets
                    </div>
                    {view.ticketItems.length > 0 && (
                      <div className="text-[12.5px] text-fg-4">
                        {view.ticketItems.reduce((sum, d) => sum + (d.quantity ?? 1), 0)} passes
                        included in your partnership
                      </div>
                    )}
                  </div>
                  {(() => {
                    const redeemBy = view.ticketItems
                      .map((d) => d.dueDate)
                      .filter((d): d is string => !!d)
                      .sort()
                      .at(-1);
                    return (
                      redeemBy && (
                        <div className="text-right">
                          <div className="eyebrow">Redeem by</div>
                          <div
                            className="font-mono text-[13px] font-semibold"
                            style={{ color: "var(--warn)" }}
                          >
                            {redeemBy}
                          </div>
                        </div>
                      )
                    );
                  })()}
                </div>

                {view.ticketItems.length === 0 ? (
                  <div className="text-[12.5px] text-fg-4">No passes recorded yet.</div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {view.ticketItems.map((d) => {
                      const code = ticketCodes[d.id];
                      return (
                        <div
                          key={d.id}
                          className="flex flex-col gap-2 rounded-[9px] p-3.5"
                          style={{ border: "1px solid var(--dtm-hairline)", background: "var(--dtm-ink-2)" }}
                        >
                          <div className="flex justify-between items-center gap-3">
                            <div className="text-[13.5px] text-fg-1">{d.name}</div>
                            {d.quantity && d.quantity > 1 && (
                              <div className="font-mono text-[15px] text-fg-3">× {d.quantity}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t pt-2" style={{ borderColor: "var(--dtm-hairline)" }}>
                            <span className="eyebrow">Redemption code</span>
                            {code ? (
                              <span className="font-mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                                {code}
                              </span>
                            ) : (
                              <span className="font-mono text-[12px] text-fg-5">Not yet generated</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {view.ticketItems.length > 0 && (
                  <div className="text-[12.5px] text-fg-4 leading-[1.5]">
                    Use each code at{" "}
                    <a href="https://www.deeptech.build/tickets" target="_blank" rel="noreferrer">
                      deeptech.build/tickets
                    </a>{" "}
                    to redeem the matching pass. Register the passes even before you know who is
                    coming — names can be transferred later.
                  </div>
                )}
              </Card>

              <Card>
                <BrandAssetsCard slug={slug} brandAssets={brandAssets} />
              </Card>

              {view.eventSections.map((section) => {
                // eventSections is only ever built from CURRENT_CYCLE_EVENTS
                // (DTM27 / SPARTA 2027), which is exactly the MediaKitEvent set.
                const mediaKitEvent = section.event as MediaKitEvent;
                const kit = mediaKit[mediaKitEvent];
                if (!kit.hasImage && !kit.copy) return null;
                const title =
                  view.eventSections.length > 1 ? `${section.eventLabel} media kit` : "Your media kit";
                return (
                  <Card key={`ready-${section.event}`}>
                    <div className="text-[15px] font-semibold text-fg-1">{title}</div>
                    {kit.hasImage && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/media-kit/${slug}/${mediaKitEventSlug(mediaKitEvent)}`}
                          alt={`${section.eventLabel} LinkedIn image`}
                          className="max-h-[180px] max-w-full rounded-[8px] border border-dtm-hairline object-contain"
                        />
                        <div className="flex gap-2">
                          <SmallButton href={`/api/media-kit/${slug}/${mediaKitEventSlug(mediaKitEvent)}`}>
                            View
                          </SmallButton>
                          <SmallButton
                            href={`/api/media-kit/${slug}/${mediaKitEventSlug(mediaKitEvent)}`}
                            download
                          >
                            Download
                          </SmallButton>
                        </div>
                      </>
                    )}
                    {kit.copy && (
                      <>
                        <div
                          className="whitespace-pre-wrap rounded-[9px] p-3 text-[13px] text-fg-2"
                          style={{ border: "1px solid var(--dtm-hairline)", background: "var(--dtm-ink-2)" }}
                        >
                          {kit.copy}
                        </div>
                        <div>
                          <CopyTextButton text={kit.copy} />
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}

              {view.hasBooth && portalContent.exhibitorGuidelinesUrl && (
                <Card>
                  <div className="flex justify-between items-center gap-2.5">
                    <div className="text-[15px] font-semibold text-fg-1">Exhibitor guidelines</div>
                    <a href={portalContent.exhibitorGuidelinesUrl} target="_blank" rel="noreferrer" className="text-sm">
                      View ↗
                    </a>
                  </div>
                  <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                    Booth dimensions, print specifications, furniture, power, delivery and build
                    times — everything you need to prepare your stand.
                  </div>
                </Card>
              )}

              {portalContent.platformUrl && (
                <Card>
                  <div className="flex justify-between items-center gap-2.5">
                    <div className="text-[15px] font-semibold text-fg-1">DTM27 platform</div>
                    <a href={portalContent.platformUrl} target="_blank" rel="noreferrer" className="text-sm">
                      View ↗
                    </a>
                  </div>
                  <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                    You will receive an invitation by email. Completing your profile is what drives
                    your 1:1 matches.
                  </div>
                </Card>
              )}

            </div>

            {hasRightColumn && (
              <div className="flex flex-col gap-[18px] min-w-0">
                {hasPending && (
                  <Card>
                    <div>
                      <div className="text-[15px] font-semibold text-fg-1">Coming your way</div>
                      <div className="text-[12.5px] text-fg-4">We email you as each one lands.</div>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-3.5" style={{ borderTop: "1px solid var(--dtm-hairline)" }}>
                      <div className="flex justify-between items-center gap-2.5">
                        <div className="text-[13.5px] font-semibold text-fg-1">Your agenda</div>
                        <Chip color="var(--fg-5)" bg="var(--dtm-surface-2)">
                          Coming soon
                        </Chip>
                      </div>
                      <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                        Your individual schedule of sessions and talks — we will email you once
                        it is ready.
                      </div>
                    </div>

                    {pendingMediaKitSections.map((section) => {
                  const title =
                    view.eventSections.length > 1 ? `${section.eventLabel} media kit` : "Your media kit";
                  return (
                    <div
                      key={section.event}
                      className="flex flex-col gap-2.5 pt-3.5"
                      style={{ borderTop: "1px solid var(--dtm-hairline)" }}
                    >
                      <div className="flex justify-between items-center gap-2.5">
                        <div className="text-[13.5px] font-semibold text-fg-1">{title}</div>
                        <Chip color="var(--fg-5)" bg="var(--dtm-surface-2)">
                          Coming soon
                        </Chip>
                      </div>
                      <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                        A LinkedIn-ready image and ready-to-post copy for your partnership
                        announcement.
                      </div>
                    </div>
                  );
                })}

                {guidelinesPending && (
                  <div className="flex flex-col gap-2.5 pt-3.5" style={{ borderTop: "1px solid var(--dtm-hairline)" }}>
                    <div className="flex justify-between items-center gap-2.5">
                      <div className="text-[13.5px] font-semibold text-fg-1">Exhibitor guidelines</div>
                      <Chip color="var(--fg-5)" bg="var(--dtm-surface-2)">
                        Coming soon
                      </Chip>
                    </div>
                    <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                      Booth dimensions, print specifications, furniture, power, delivery and build
                      times — everything you need to prepare your stand.
                    </div>
                  </div>
                )}

                {platformPending && (
                  <div className="flex flex-col gap-2.5 pt-3.5" style={{ borderTop: "1px solid var(--dtm-hairline)" }}>
                    <div className="flex justify-between items-center gap-2.5">
                      <div className="text-[13.5px] font-semibold text-fg-1">DTM27 platform</div>
                      <Chip color="var(--fg-5)" bg="var(--dtm-surface-2)">
                        Live 5 Apr 2027
                      </Chip>
                    </div>
                    <div className="text-[12.5px] text-fg-4 leading-[1.55]">
                      You will receive an invitation by email. Completing your profile is what drives
                      your 1:1 matches.
                    </div>
                  </div>
                )}
                  </Card>
                )}

                {view.hasBooth && (
                  <Card style={{ border: "1px solid rgb(212 54 122 / 28%)" }}>
                    <div className="text-[15px] font-semibold text-fg-1">
                      Need a hand with your booth design?
                    </div>
                    <div className="text-[13px] text-fg-3 leading-[1.6]">
                      <strong style={{ color: "var(--accent)" }}>Moat Studio</strong> is our design
                      partner and already knows the DTM specifications inside out — they&apos;ll turn
                      your brief into print-ready artwork. Fill out the form below and
                      we&apos;ll connect you with them directly.
                    </div>
                    <MoatIntroForm
                      slug={slug}
                      initialName={partnerContact?.name ?? ""}
                      initialEmail={partnerContact?.email ?? ""}
                    />
                  </Card>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {tab === "actions" && (
          <div className="flex flex-col gap-4">
            <div className="text-[13px] text-fg-4">
              A few things we need from you to keep everything on track.
            </div>
            <div className="flex flex-col gap-3">
              {view.partnerObligations.map((o) => {
                // "Submit your brand guidelines" reflects real data instead
                // of one manual tick — three sub-checks that each tick
                // themselves the moment that piece exists (logo uploaded
                // either by the partner or via email, website URL,
                // description), rather than a single checkbox.
                if (o.id === "logo") {
                  const hasLogo = brandAssets.logoSlots.some((s) => s.hasImage);
                  const hasWebsite = !!brandAssets.websiteUrl;
                  const hasDescription = !!brandAssets.description;
                  const allDone = hasLogo && hasWebsite && hasDescription;
                  return (
                    <Card key={o.id}>
                      <div className="text-[14px] font-medium text-fg-1">{o.title}</div>
                      <div className="text-[12.5px] text-fg-4 leading-[1.5]">{o.note}</div>
                      <div className="mt-2 flex flex-col gap-2">
                        <AutoCheckRow checked={hasLogo} label="Your logo" />
                        <AutoCheckRow checked={hasWebsite} label="Your website URL" />
                        <AutoCheckRow
                          checked={hasDescription}
                          label="Description of your company (max 250 words)"
                        />
                      </div>
                      {!allDone && (
                        <div className="mt-1 flex items-center justify-between gap-3 rounded-[9px] p-3 text-[12.5px] leading-[1.5]"
                          style={{ border: "1px solid var(--dtm-hairline)", background: "var(--dtm-ink-2)" }}
                        >
                          <span className="text-fg-4">
                            These tick themselves off — upload your logo and save your website URL
                            and description under Tickets &amp; assets, and they&apos;ll check here
                            automatically.
                          </span>
                          <button
                            type="button"
                            onClick={() => setTab("assets")}
                            className="shrink-0 whitespace-nowrap text-[12.5px] font-medium"
                            style={{ color: "var(--accent)" }}
                          >
                            Go there →
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                }

                const checked = Boolean(obligationChecks[o.id]);
                const pending = obligationPending === o.id;
                return (
                  <Card key={o.id}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={pending}
                        onChange={(e) => handleObligationToggle(o.id, o.title, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <div className="w-full">
                        <div className="text-[14px] font-medium text-fg-1">{o.title}</div>
                        <div className="text-[12.5px] text-fg-4 leading-[1.5]">{o.note}</div>
                        {pending && <div className="mt-1 text-[11px] text-fg-5">Saving…</div>}
                        <div className="mt-1.5 text-[11px] text-fg-5 leading-[1.4]">
                          The DTM team is notified when you check or uncheck this — please only tick it
                          once it&apos;s actually done, and untick it if that changes, so we don&apos;t get
                          mixed signals.
                        </div>
                      </div>
                    </label>
                    {o.id === "announce" && (
                      <ObligationLinksEditor slug={slug} obligationId="announce" initialLinks={announceLinks} />
                    )}
                    {isNomineeObligation(o.id) && (
                      <NomineeEditor
                        slug={slug}
                        obligationId={o.id}
                        title={o.title}
                        initialNominees={nomineesByObligation[o.id] ?? []}
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
