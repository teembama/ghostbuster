"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Briefcase,
  ArrowUpRight,
  ListFilter,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

const FRAUD_TYPES = [
  "Ghost Worker",
  "Duplicate Identity",
  "Salary Fraud",
  "Network Fraud",
] as const;
type FraudType = (typeof FRAUD_TYPES)[number];

type CaseStatus = "Open" | "Under Review" | "Resolved";

interface Case {
  id: string;
  name: string;
  ministry: string;
  fraudType: FraudType;
  riskScore: number;
  status: CaseStatus;
  assignedTo: string;
  dateOpened: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const CASES: Case[] = [
  { id: "EMP-3821", name: "Ibrahim Musa", ministry: "Finance", fraudType: "Ghost Worker", riskScore: 97, status: "Open", assignedTo: "A. Okonkwo", dateOpened: "Apr 12, 2024" },
  { id: "EMP-7143", name: "Tunde Fashola", ministry: "Health", fraudType: "Ghost Worker", riskScore: 95, status: "Under Review", assignedTo: "B. Adeleke", dateOpened: "Apr 10, 2024" },
  { id: "EMP-1189", name: "Kola Balogun", ministry: "Health", fraudType: "Ghost Worker", riskScore: 91, status: "Open", assignedTo: "A. Okonkwo", dateOpened: "Apr 14, 2024" },
  { id: "EMP-2205", name: "Ngozi Eze", ministry: "Education", fraudType: "Duplicate Identity", riskScore: 88, status: "Under Review", assignedTo: "C. Nwosu", dateOpened: "Apr 9, 2024" },
  { id: "EMP-5912", name: "Emeka Obi", ministry: "Agriculture", fraudType: "Duplicate Identity", riskScore: 85, status: "Open", assignedTo: "B. Adeleke", dateOpened: "Apr 15, 2024" },
  { id: "EMP-4438", name: "Bola Ahmed", ministry: "Works", fraudType: "Salary Fraud", riskScore: 79, status: "Under Review", assignedTo: "D. Sule", dateOpened: "Apr 8, 2024" },
  { id: "EMP-6674", name: "Yemi Lawal", ministry: "Interior", fraudType: "Network Fraud", riskScore: 76, status: "Resolved", assignedTo: "C. Nwosu", dateOpened: "Apr 3, 2024" },
  { id: "EMP-9012", name: "Chioma Nwosu", ministry: "Finance", fraudType: "Salary Fraud", riskScore: 72, status: "Open", assignedTo: "D. Sule", dateOpened: "Apr 16, 2024" },
  { id: "EMP-8347", name: "Funke Akindele", ministry: "Education", fraudType: "Network Fraud", riskScore: 68, status: "Resolved", assignedTo: "A. Okonkwo", dateOpened: "Apr 1, 2024" },
  { id: "EMP-3056", name: "Ade Sankore", ministry: "Works", fraudType: "Salary Fraud", riskScore: 63, status: "Resolved", assignedTo: "B. Adeleke", dateOpened: "Mar 28, 2024" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CaseStatus, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  Open: { icon: AlertCircle, cls: "bg-gb-danger/10 text-gb-danger ring-1 ring-gb-danger/25" },
  "Under Review": { icon: Clock, cls: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/25" },
  Resolved: { icon: CheckCircle2, cls: "bg-gb-success/10 text-gb-success ring-1 ring-gb-success/25" },
};

const FRAUD_PILL: Record<FraudType, string> = {
  "Ghost Worker": "bg-gb-danger/10 text-gb-danger ring-gb-danger/20",
  "Duplicate Identity": "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  "Salary Fraud": "bg-yellow-400/10 text-yellow-400 ring-yellow-400/20",
  "Network Fraud": "bg-purple-400/10 text-purple-400 ring-purple-400/20",
};

function riskBadge(score: number) {
  if (score > 80)
    return "bg-gb-danger/15 text-gb-danger ring-1 ring-gb-danger/30";
  return "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FraudType | "All">("All");
  const [filterStatus, setFilterStatus] = useState<CaseStatus | "All">("All");
  const [sortDesc, setSortDesc] = useState(true);

  const openCount = CASES.filter((c) => c.status === "Open").length;
  const reviewCount = CASES.filter((c) => c.status === "Under Review").length;
  const resolvedCount = CASES.filter((c) => c.status === "Resolved").length;

  const rows = useMemo(() => {
    let base = CASES;
    if (filterType !== "All") base = base.filter((c) => c.fraudType === filterType);
    if (filterStatus !== "All") base = base.filter((c) => c.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.ministry.toLowerCase().includes(q)
      );
    }
    return [...base].sort((a, b) =>
      sortDesc ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
    );
  }, [filterType, filterStatus, search, sortDesc]);

  return (
    <div className="min-h-full bg-gb-bg px-4 py-6 space-y-7 sm:px-8 sm:py-10">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Case Management</h1>
          <p className="mt-1 text-sm text-gb-muted">
            Track and investigate flagged employee cases
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gb-danger/10 px-3 py-1 text-xs font-bold text-gb-danger">
            {openCount} Open
          </span>
          <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">
            {reviewCount} Under Review
          </span>
          <span className="rounded-full bg-gb-success/10 px-3 py-1 text-xs font-bold text-gb-success">
            {resolvedCount} Resolved
          </span>
        </div>
      </div>

      {/* ── Filter / search bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 min-w-[200px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-gb-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, ministry…"
            className="bg-transparent text-sm text-white outline-none placeholder:text-gb-muted w-full"
          />
        </div>

        {/* Fraud type filter */}
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <ListFilter className="h-3.5 w-3.5 text-gb-muted" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FraudType | "All")}
            className="bg-transparent text-sm text-white outline-none cursor-pointer"
          >
            <option value="All" className="bg-[#0D1426]">All Fraud Types</option>
            {FRAUD_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0D1426]">{t}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <Briefcase className="h-3.5 w-3.5 text-gb-muted" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CaseStatus | "All")}
            className="bg-transparent text-sm text-white outline-none cursor-pointer"
          >
            <option value="All" className="bg-[#0D1426]">All Statuses</option>
            {(["Open", "Under Review", "Resolved"] as CaseStatus[]).map((s) => (
              <option key={s} value={s} className="bg-[#0D1426]">{s}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <button
          type="button"
          onClick={() => setSortDesc((d) => !d)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gb-muted transition-colors hover:text-white"
        >
          {sortDesc ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          Risk: {sortDesc ? "Highest first" : "Lowest first"}
        </button>

        <span className="ml-auto text-xs text-gb-muted">
          {rows.length} case{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Cases table ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {["Employee", "Ministry", "Fraud Type", "Risk Score", "Status", "Assigned To", "Opened", "Action"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gb-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const status = STATUS_CONFIG[c.status];
              const StatusIcon = status.icon;
              return (
                <tr
                  key={c.id}
                  className={cn(
                    "border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]",
                    i === rows.length - 1 && "border-none"
                  )}
                >
                  {/* Employee */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gb-muted">{c.id}</p>
                  </td>

                  {/* Ministry */}
                  <td className="px-5 py-4 text-white/70">Min. of {c.ministry}</td>

                  {/* Fraud type */}
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                        FRAUD_PILL[c.fraudType]
                      )}
                    >
                      {c.fraudType}
                    </span>
                  </td>

                  {/* Risk score */}
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums",
                        riskBadge(c.riskScore)
                      )}
                    >
                      {c.riskScore}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", status.cls)}>
                      <StatusIcon className="h-3 w-3" />
                      {c.status}
                    </span>
                  </td>

                  {/* Assigned to */}
                  <td className="px-5 py-4 text-white/70 text-xs">{c.assignedTo}</td>

                  {/* Date opened */}
                  <td className="px-5 py-4 text-white/50 text-xs">{c.dateOpened}</td>

                  {/* Action */}
                  <td className="px-5 py-4">
                    <Link
                      href={`/case/${c.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gb-accent/25 bg-gb-accent/10 px-3 py-1.5 text-xs font-semibold text-gb-accent transition-colors hover:bg-gb-accent/20"
                    >
                      View
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-16 text-center text-gb-muted text-sm">
            No cases match the selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
