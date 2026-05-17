"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Banknote,
  TrendingDown,
  ArrowUpRight,
  ListFilter,
  TrendingUp,
  CircleAlert,
  Download,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAnalysisResults,
  listEmployees,
  disburseSalaries,
  type AnalysisResult,
  type Employee,
  type DisburseResponse,
} from "@/lib/api";
import { ResultsSkeleton } from "@/components/skeletons";
import { downloadCSV } from "@/lib/csv";
import { friendlyApiError } from "@/lib/errors";

const FraudNetworkGraph = dynamic(
  () => import("@/components/FraudNetworkGraph"),
  { ssr: false }
);

const UPLOAD_ID_KEY = "upload_id";

// ─── Display constants ────────────────────────────────────────────────────────

const FRAUD_TYPES = [
  "Ghost Worker",
  "Duplicate Identity",
  "Salary Fraud",
  "Network Fraud",
] as const;
type FraudType = (typeof FRAUD_TYPES)[number];

const FRAUD_TYPE_COLOR: Record<FraudType, string> = {
  "Ghost Worker": "#FF3B5C",
  "Duplicate Identity": "#FF9500",
  "Salary Fraud": "#FFD60A",
  "Network Fraud": "#BF5AF2",
};

const FRAUD_PILL: Record<FraudType, string> = {
  "Ghost Worker": "bg-gb-danger/10 text-gb-danger ring-gb-danger/20",
  "Duplicate Identity": "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  "Salary Fraud": "bg-yellow-400/10 text-yellow-400 ring-yellow-400/20",
  "Network Fraud": "bg-purple-400/10 text-purple-400 ring-purple-400/20",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  return `₦${n.toLocaleString()}`;
}

// Abbreviate a ministry name to its uppercase initials, ignoring filler words.
// Used for chart X-axis tick labels; full name is preserved in the tooltip.
function abbreviateMinistry(name: string): string {
  return name
    .split(" ")
    .filter((w) => !["of", "the", "and", "for", "federal"].includes(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function riskBadge(score: number) {
  if (score > 80)
    return "bg-gb-danger/15 text-gb-danger ring-1 ring-gb-danger/30";
  return "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25";
}

// Pick a single fraud type for table display from the employee's red_flags.
// Priority: BIOMETRIC → Ghost Worker, NETWORK → Network Fraud, SALARY → Salary
// Fraud, ATTENDANCE → Ghost Worker (no biometric flag), fallback Duplicate.
function inferFraudType(employee: Employee): FraudType {
  const types = new Set((employee.red_flags ?? []).map((f) => f.type));
  if (types.has("BIOMETRIC")) return "Ghost Worker";
  if (types.has("NETWORK")) return "Network Fraud";
  if (types.has("SALARY")) return "Salary Fraud";
  if (types.has("ATTENDANCE")) return "Ghost Worker";
  return "Duplicate Identity";
}

// ─── Custom recharts elements ─────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1426] px-4 py-3 shadow-xl">
      {label && <p className="mb-1.5 text-xs font-semibold text-white/60">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color ?? p.fill ?? "#fff" }}>
          {p.name}: <span className="text-white">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: AnalysisResult }
  | { kind: "error"; message: string };

type DisburseState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: DisburseResponse }
  | { kind: "error"; message: string };

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [filterType, setFilterType] = useState<FraudType | "All">("All");
  const [sortDesc, setSortDesc] = useState(true);
  const [showDisburseConfirm, setShowDisburseConfirm] = useState(false);
  const [disburse, setDisburse] = useState<DisburseState>({ kind: "idle" });
  // Holds complete employee lists fetched in parallel for accurate bar chart data.
  // The main AnalysisResult.employees is a small paginated subset and cannot be
  // used for per-ministry aggregation across all 10 000+ records.
  const [fullEmployees, setFullEmployees] = useState<{
    flagged: Employee[];
    all: Employee[];
  } | null>(null);

  // Pull upload_id from URL, fall back to localStorage so a direct nav to
  // /results still works after a successful upload in this browser.
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

  // All four fetches fire in parallel. The employee list calls (page_size=10000)
  // provide complete per-ministry data for the bar chart. The main results call
  // provides the summary KPIs. All are required before we render.
  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const [res, reviewRes, highRiskRes, allRes] = await Promise.all([
          getAnalysisResults(uploadId),
          listEmployees(uploadId, { page: 1, page_size: 10000, classification: "REVIEW_REQUIRED" }),
          listEmployees(uploadId, { page: 1, page_size: 10000, classification: "HIGH_RISK" }),
          listEmployees(uploadId, { page: 1, page_size: 10000 }),
        ]);
        if (cancelled) return;

        if ("status" in res && res.status === "processing") {
          router.replace("/upload");
          return;
        }
        setState({ kind: "ready", data: res as AnalysisResult });
        setFullEmployees({
          flagged: [...reviewRes.employees, ...highRiskRes.employees],
          all: allRes.employees,
        });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: friendlyApiError(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uploadId, router]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const data = state.kind === "ready" ? state.data : null;

  const employees = data?.employees ?? [];
  // Any employee who is not VERIFIED is considered flagged (covers both
  // HIGH_RISK and REVIEW_REQUIRED). Used by bar chart, table, and CSV.
  const flaggedEmployees = useMemo(
    () => employees.filter((e) => e.classification !== "VERIFIED"),
    [employees],
  );

  const pieData = useMemo(() => {
    if (!data) return [];
    const fb = data.fraud_breakdown;
    return [
      { name: "Ghost Workers", value: fb.ghost_workers, color: FRAUD_TYPE_COLOR["Ghost Worker"] },
      { name: "Duplicate IDs", value: fb.duplicate_identities, color: FRAUD_TYPE_COLOR["Duplicate Identity"] },
      { name: "Salary Fraud", value: fb.salary_fraud, color: FRAUD_TYPE_COLOR["Salary Fraud"] },
      { name: "Network Fraud", value: fb.network_fraud, color: FRAUD_TYPE_COLOR["Network Fraud"] },
    ];
  }, [data]);

  // Per-ministry flagged count and total, built from the complete employee
  // fetches (not the paginated subset in data.employees). Top 8 by flagged count.
  const barData = useMemo(() => {
    if (!fullEmployees) return [];
    const normalize = (raw: string | null | undefined) =>
      (raw || "Unknown")
        .replace(/^Ministry of\s+/i, "")
        .replace(/^Min\.\s+of\s+/i, "");

    const flaggedByMinistry = new Map<string, number>();
    for (const emp of fullEmployees.flagged) {
      const m = normalize(emp.ministry);
      flaggedByMinistry.set(m, (flaggedByMinistry.get(m) ?? 0) + 1);
    }

    const totalByMinistry = new Map<string, number>();
    for (const emp of fullEmployees.all) {
      const m = normalize(emp.ministry);
      totalByMinistry.set(m, (totalByMinistry.get(m) ?? 0) + 1);
    }

    return Array.from(flaggedByMinistry.entries())
      .map(([ministry, flaggedCount]) => ({
        ministry,
        flaggedCount,
        total: totalByMinistry.get(ministry) ?? flaggedCount,
      }))
      .sort((a, b) => b.flaggedCount - a.flaggedCount)
      .slice(0, 8);
  }, [fullEmployees]);

  type Row = {
    id: string;
    name: string;
    ministry: string;
    fraudType: FraudType;
    riskScore: number;
  };

  // Raw employees in the same order the table renders them — filter +
  // sort applied. Used both for the table rows below and the Download
  // Table button so the CSV exactly matches what the user is seeing.
  const displayedEmployees = useMemo(() => {
    const base =
      filterType === "All"
        ? flaggedEmployees
        : flaggedEmployees.filter((e) => inferFraudType(e) === filterType);
    return [...base].sort((a, b) =>
      sortDesc ? b.fraud_score - a.fraud_score : a.fraud_score - b.fraud_score,
    );
  }, [flaggedEmployees, filterType, sortDesc]);

  const rows: Row[] = useMemo(
    () =>
      displayedEmployees.map((e) => ({
        id: e.id,
        name: e.name,
        ministry: (e.ministry || "")
          .replace(/^Ministry of\s+/i, "")
          .replace(/^Min\.\s+of\s+/i, ""),
        fraudType: inferFraudType(e),
        riskScore: Math.round(e.fraud_score),
      })),
    [displayedEmployees],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDownloadTable = () => {
    if (!uploadId || displayedEmployees.length === 0) return;
    const csvRows: string[][] = [
      ["id", "name", "ministry", "salary", "classification", "fraud_score", "fraud_type"],
      ...displayedEmployees.map((e) => [
        e.id,
        e.name,
        e.ministry,
        String(e.salary),
        e.classification,
        String(e.fraud_score),
        e.red_flags?.[0]?.type ?? "UNKNOWN",
      ]),
    ];
    downloadCSV(`ghostbuster-filtered-${uploadId}.csv`, csvRows);
  };

  const handleDisburseConfirm = async () => {
    if (!uploadId) return;
    setShowDisburseConfirm(false);
    setDisburse({ kind: "loading" });
    try {
      const result = await disburseSalaries(uploadId, true);
      setDisburse({ kind: "success", result });
    } catch (err) {
      setDisburse({ kind: "error", message: friendlyApiError(err) });
    }
  };

  // ── Render branches ───────────────────────────────────────────────────────

  if (!uploadId) {
    return (
      <div className="min-h-full bg-gb-bg px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center space-y-4">
          <h1 className="text-lg font-semibold text-white">No analysis selected</h1>
          <p className="text-sm text-gb-muted">
            Upload a payroll CSV to see fraud analysis results.
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

  // Brief skeleton during the single fetch (typically <200ms). No polling,
  // no progress UI — if we get a 202 here the effect bounces back to /upload.
  if (state.kind === "loading") {
    return <ResultsSkeleton />;
  }

  if (state.kind === "error") {
    return (
      <div className="min-h-full bg-gb-bg px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-gb-danger/25 bg-gb-danger/5 p-8 text-center space-y-4">
          <CircleAlert className="mx-auto h-8 w-8 text-gb-danger" />
          <h1 className="text-lg font-semibold text-white">Failed to load results</h1>
          <p className="text-sm text-gb-muted break-words">{state.message}</p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to Upload
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return <ResultsSkeleton />;

  const totalEmployees = data.total_employees;
  // Use API-provided counts so all four KPI cards are mathematically
  // consistent: Total = Flagged + Clean regardless of array contents.
  const flaggedCount = data.flagged_count;
  const cleanCount = data.total_employees - data.flagged_count;
  const verifiedCount = employees.filter((e) => e.classification === "VERIFIED").length;
  const verifiedTotalPay = employees
    .filter((e) => e.classification === "VERIFIED")
    .reduce((sum, e) => sum + (e.salary || 0), 0);
  const estimatedLoss = data.estimated_loss;

  return (
    <div className="min-h-full bg-gb-bg px-4 py-6 space-y-7 sm:px-8 sm:py-10">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Analysis Results</h1>
          <p className="mt-1 text-sm text-gb-muted">
            {totalEmployees.toLocaleString()} records processed
            {data.analysis_duration_seconds > 0 && (
              <> &mdash; analysis took {data.analysis_duration_seconds.toFixed(2)}s</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Disburse — opens confirm dialog, posts live (no dry run) on confirm */}
          <button
            type="button"
            onClick={() => setShowDisburseConfirm(true)}
            disabled={disburse.kind === "loading" || cleanCount === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gb-success px-5 py-2.5 text-sm font-semibold text-[#0A0F1E] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disburse.kind === "loading" ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              Disburse to Verified ({cleanCount.toLocaleString()})
            </span>
            <span className="sm:hidden">
              Disburse ({cleanCount.toLocaleString()})
            </span>
          </button>
        </div>
      </div>

      {/* ── Disburse confirmation dialog ──────────────────────────────────── */}
      {showDisburseConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disburse-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowDisburseConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-gb-sidebar p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gb-success/10">
                <ShieldCheck className="h-5 w-5 text-gb-success" />
              </div>
              <h2 id="disburse-confirm-title" className="text-base font-semibold text-white">
                Confirm Disbursement
              </h2>
            </div>

            <p className="mb-4 text-sm text-gb-muted">
              Disburse{" "}
              <span className="font-semibold text-white">
                ₦{verifiedTotalPay.toLocaleString()}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-white">
                {cleanCount.toLocaleString()} verified employees
              </span>
              ?
            </p>
            <p className="mb-6 text-xs text-gb-muted">
              Only VERIFIED employees will receive funds. High-risk and
              review-required records are skipped automatically. This action
              cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisburseConfirm(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisburseConfirm}
                className="rounded-lg bg-gb-success px-4 py-2 text-sm font-semibold text-[#0A0F1E] transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Confirm Disburse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disburse result banner ────────────────────────────────────────── */}
      {disburse.kind === "success" && (
        <div className="flex items-start gap-3 rounded-xl border border-gb-success/25 bg-gb-success/10 px-5 py-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gb-success" />
          <p className="text-sm text-gb-success">
            Disbursement complete &mdash;{" "}
            <span className="font-semibold">{cleanCount.toLocaleString()}</span> of{" "}
            <span className="font-semibold">{cleanCount.toLocaleString()}</span> transfers
            successful, total paid:{" "}
            <span className="font-semibold">
              ₦{disburse.result.total_amount_naira.toLocaleString()}
            </span>
          </p>
        </div>
      )}
      {disburse.kind === "error" && (
        <div className="flex items-start gap-3 rounded-xl border border-gb-danger/20 bg-gb-danger/10 px-5 py-4">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-gb-danger" />
          <p className="text-sm text-gb-danger break-words">{disburse.message}</p>
        </div>
      )}

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Total Employees"
          value={totalEmployees.toLocaleString()}
          sub="Registered in payroll"
          iconClass="text-gb-accent"
          iconBg="bg-gb-accent/10"
        />
        <SummaryCard
          icon={ShieldAlert}
          label="Flagged Records"
          value={flaggedCount.toLocaleString()}
          sub={totalEmployees > 0 ? `${((flaggedCount / totalEmployees) * 100).toFixed(1)}% of total` : ""}
          iconClass="text-gb-danger"
          iconBg="bg-gb-danger/10"
          valueClass="text-gb-danger"
          border="border-gb-danger/15"
        />
        <SummaryCard
          icon={Banknote}
          label="Estimated Loss"
          value={formatNaira(estimatedLoss)}
          sub="Monthly payroll exposure"
          iconClass="text-gb-danger"
          iconBg="bg-gb-danger/10"
          valueClass="text-gb-danger"
          border="border-gb-danger/15"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Verified Clean"
          value={cleanCount.toLocaleString()}
          sub={totalEmployees > 0 ? `${((cleanCount / totalEmployees) * 100).toFixed(1)}% of total` : ""}
          iconClass="text-gb-success"
          iconBg="bg-gb-success/10"
          valueClass="text-gb-success"
          border="border-gb-success/15"
        />
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Pie chart */}
        <div className="col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 lg:col-span-2">
          <p className="text-sm font-semibold text-white">Fraud Breakdown</p>
          <p className="mt-0.5 text-xs text-gb-muted">By category</p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-2">
            {pieData.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-sm text-white/70">{d.name}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-white">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bar chart */}
        <div className="col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 lg:col-span-3">
          <p className="text-sm font-semibold text-white">Fraud Rate by Ministry</p>
          <p className="mt-0.5 text-xs text-gb-muted">
            Hover over bars to see ministry breakdown
          </p>
          <div className="mt-4 h-64">
            {barData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gb-muted">
                No flagged records to chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="ministry"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    tickFormatter={abbreviateMinistry}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: "Flagged Employees",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      style: { fill: "rgba(255,255,255,0.45)", fontSize: 11, textAnchor: "middle" },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as {
                        ministry: string;
                        flaggedCount: number;
                        total: number;
                      };
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#0D1426] px-4 py-3 shadow-xl">
                          <p className="mb-1.5 text-xs font-semibold text-white/60">
                            {label ?? row.ministry}
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {row.flaggedCount.toLocaleString()} of{" "}
                            {row.total.toLocaleString()} employees flagged
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="flaggedCount"
                    fill="#FF3B5C"
                    radius={[4, 4, 0, 0]}
                    name="Flagged"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Fraud network graph ──────────────────────────────────────────────── */}
      {/* Header stays inside the page padding; the graph itself breaks out via
          negative margins so it spans edge-to-edge with no gaps beside it. */}
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Fraud Network</h2>
          <p className="mt-0.5 text-xs text-gb-muted">Connections between flagged employees</p>
        </div>
        <div className="-mx-4 h-full w-auto sm:-mx-8">
          <FraudNetworkGraph />
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
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

        <button
          type="button"
          onClick={() => setSortDesc((d) => !d)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gb-muted transition-colors hover:text-white"
        >
          {sortDesc ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          Risk Score: {sortDesc ? "Highest first" : "Lowest first"}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gb-muted">
            Showing {rows.length} of {flaggedCount.toLocaleString()} flagged records
          </span>
          <button
            type="button"
            onClick={handleDownloadTable}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download Table
          </button>
        </div>
      </div>

      {/* ── Flagged employees table ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {["Employee", "Ministry", "Fraud Type", "Risk Score", "Action"].map((h) => (
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
            {rows.map((emp, i) => (
              <tr
                key={emp.id}
                className={cn(
                  "border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]",
                  i === rows.length - 1 && "border-none"
                )}
              >
                <td className="px-5 py-4">
                  <p className="font-medium text-white">{emp.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-gb-muted">{emp.id.slice(0, 8)}</p>
                </td>
                <td className="px-5 py-4 text-white/70">
                  {emp.ministry ? `Min. of ${emp.ministry}` : "—"}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                      FRAUD_PILL[emp.fraudType]
                    )}
                  >
                    {emp.fraudType}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums",
                      riskBadge(emp.riskScore)
                    )}
                  >
                    {emp.riskScore}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/case/${emp.id}?upload_id=${encodeURIComponent(uploadId)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gb-accent/25 bg-gb-accent/10 px-3 py-1.5 text-xs font-semibold text-gb-accent transition-colors hover:bg-gb-accent/20"
                  >
                    View Case
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-16 text-center text-gb-muted text-sm">
            {flaggedCount === 0
              ? "No flagged records — payroll is clean."
              : "No records match the selected filter."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
  iconBg,
  valueClass = "text-white",
  border = "border-white/[0.08]",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  iconClass: string;
  iconBg: string;
  valueClass?: string;
  border?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-white/[0.03] p-5", border)}>
      <div className="flex items-start justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg)}>
          <Icon className={cn("h-4.5 w-4.5", iconClass)} />
        </div>
      </div>
      <p className={cn("mt-4 text-2xl font-bold tabular-nums tracking-tight", valueClass)}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-white/80">{label}</p>
      <p className="mt-0.5 text-[11px] text-gb-muted">{sub}</p>
    </div>
  );
}
