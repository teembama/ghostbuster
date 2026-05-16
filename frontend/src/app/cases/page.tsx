"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";
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
  Loader,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listEmployees,
  ApiError,
  API_BASE_URL,
  type Employee,
  type Classification,
} from "@/lib/api";

const UPLOAD_ID_KEY = "upload_id";

// ─── Types ────────────────────────────────────────────────────────────────────

const FRAUD_TYPES = [
  "Ghost Worker",
  "Duplicate Identity",
  "Salary Fraud",
  "Network Fraud",
] as const;
type FraudType = (typeof FRAUD_TYPES)[number];

// Backend classification → display label for the existing status pill.
const STATUS_LABEL: Record<Exclude<Classification, "VERIFIED">, "Open" | "Under Review"> = {
  HIGH_RISK: "Open",
  REVIEW_REQUIRED: "Under Review",
};

type CaseStatus = "Open" | "Under Review";

interface Case {
  id: string;
  name: string;
  ministry: string;
  fraudType: FraudType;
  riskScore: number;
  status: CaseStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferFraudType(employee: Employee): FraudType {
  const types = new Set((employee.red_flags ?? []).map((f) => f.type));
  if (types.has("BIOMETRIC")) return "Ghost Worker";
  if (types.has("NETWORK")) return "Network Fraud";
  if (types.has("SALARY")) return "Salary Fraud";
  if (types.has("ATTENDANCE")) return "Ghost Worker";
  return "Duplicate Identity";
}

const STATUS_CONFIG: Record<CaseStatus, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  Open: { icon: AlertCircle, cls: "bg-gb-danger/10 text-gb-danger ring-1 ring-gb-danger/25" },
  "Under Review": { icon: Clock, cls: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/25" },
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

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; cases: Case[] }
  | { kind: "error"; message: string };

export default function CasesPage() {
  return (
    <Suspense>
      <CasesPageInner />
    </Suspense>
  );
}

function CasesPageInner() {
  const searchParams = useSearchParams();
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FraudType | "All">("All");
  const [filterStatus, setFilterStatus] = useState<CaseStatus | "All">("All");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    const fromUrl = searchParams.get("upload_id");
    if (fromUrl) {
      setUploadId(fromUrl);
      return;
    }
    try {
      const stored = window.localStorage.getItem(UPLOAD_ID_KEY);
      if (stored) setUploadId(stored);
    } catch {
      /* storage unavailable */
    }
  }, [searchParams]);

  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        // No flaggedOnly param on the backend — fetch a large page and
        // filter client-side. 500 is the backend's max page_size.
        const res = await listEmployees(uploadId, {
          page: 1,
          page_size: 500,
          sort_by: "fraud_score",
          sort_desc: true,
        });
        if (cancelled) return;

        const cases: Case[] = res.employees
          .filter((e) => e.classification !== "VERIFIED")
          .map((e) => ({
            id: e.id,
            name: e.name || "—",
            ministry: (e.ministry || "").replace(/^Ministry of\s+/i, "").replace(/^Min\.\s+of\s+/i, ""),
            fraudType: inferFraudType(e),
            riskScore: Math.round(e.fraud_score),
            status: STATUS_LABEL[e.classification as Exclude<Classification, "VERIFIED">],
          }));

        setState({ kind: "ready", cases });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.status === 0
              ? `Could not reach backend at ${API_BASE_URL}.`
              : `${err.status}: ${err.detail}`
            : err instanceof Error
              ? err.message
              : "Failed to load cases.";
        setState({ kind: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uploadId]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const cases = state.kind === "ready" ? state.cases : [];

  const openCount = cases.filter((c) => c.status === "Open").length;
  const reviewCount = cases.filter((c) => c.status === "Under Review").length;

  const rows = useMemo(() => {
    let base = cases;
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
  }, [cases, filterType, filterStatus, search, sortDesc]);

  // ── Render branches ───────────────────────────────────────────────────────

  if (!uploadId) {
    return (
      <div className="min-h-full bg-gb-bg px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center space-y-4">
          <h1 className="text-lg font-semibold text-white">No analysis selected</h1>
          <p className="text-sm text-gb-muted">
            Upload a payroll CSV to see flagged cases.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-xl bg-gb-accent px-5 py-2.5 text-sm font-semibold text-gb-bg hover:brightness-110"
          >
            Go to Upload
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-full items-center justify-center bg-gb-bg p-8">
        <div className="flex items-center gap-3 text-sm text-gb-muted">
          <Loader className="h-4 w-4 animate-spin text-gb-accent" />
          Loading cases…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="min-h-full bg-gb-bg px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-gb-danger/25 bg-gb-danger/5 p-8 text-center space-y-4">
          <CircleAlert className="mx-auto h-8 w-8 text-gb-danger" />
          <h1 className="text-lg font-semibold text-white">Failed to load cases</h1>
          <p className="text-sm text-gb-muted break-words">{state.message}</p>
        </div>
      </div>
    );
  }

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
        </div>
      </div>

      {/* ── Filter / search bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 min-w-[200px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-gb-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, ministry…"
            className="bg-transparent text-sm text-white outline-none placeholder:text-gb-muted w-full"
          />
        </div>

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

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <Briefcase className="h-3.5 w-3.5 text-gb-muted" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CaseStatus | "All")}
            className="bg-transparent text-sm text-white outline-none cursor-pointer"
          >
            <option value="All" className="bg-[#0D1426]">All Statuses</option>
            {(["Open", "Under Review"] as CaseStatus[]).map((s) => (
              <option key={s} value={s} className="bg-[#0D1426]">{s}</option>
            ))}
          </select>
        </div>

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
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {["Employee", "Ministry", "Fraud Type", "Risk Score", "Status", "Action"].map((h) => (
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
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gb-muted">{c.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-4 text-white/70">{c.ministry ? `Min. of ${c.ministry}` : "—"}</td>
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
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", status.cls)}>
                      <StatusIcon className="h-3 w-3" />
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/case/${c.id}?upload_id=${encodeURIComponent(uploadId)}`}
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
            {cases.length === 0
              ? "No flagged cases — payroll is clean."
              : "No cases match the selected filters."}
          </div>
        )}
      </div>
    </div>
  );
}
