"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const FraudNetworkGraph = dynamic(
  () => import("@/components/FraudNetworkGraph"),
  { ssr: false }
);

// ─── Mock data ────────────────────────────────────────────────────────────────

const SUMMARY = {
  total: 10_000,
  flagged: 847,
  loss: 2_147_500_000,
  clean: 9_153,
};

const PIE_DATA = [
  { name: "Ghost Workers", value: 312, color: "#FF3B5C" },
  { name: "Duplicate IDs", value: 198, color: "#FF9500" },
  { name: "Salary Fraud", value: 156, color: "#FFD60A" },
  { name: "Network Fraud", value: 181, color: "#BF5AF2" },
];

const BAR_DATA = [
  { ministry: "Finance", flagged: 185 },
  { ministry: "Education", flagged: 142 },
  { ministry: "Health", flagged: 121 },
  { ministry: "Interior", flagged: 98 },
  { ministry: "Works", flagged: 167 },
  { ministry: "Agriculture", flagged: 134 },
];

const FRAUD_TYPES = [
  "Ghost Worker",
  "Duplicate Identity",
  "Salary Fraud",
  "Network Fraud",
] as const;
type FraudType = (typeof FRAUD_TYPES)[number];

interface FlaggedEmployee {
  id: string;
  name: string;
  ministry: string;
  fraudType: FraudType;
  riskScore: number;
}

const EMPLOYEES: FlaggedEmployee[] = [
  { id: "EMP-3821", name: "Ibrahim Musa", ministry: "Finance", fraudType: "Ghost Worker", riskScore: 97 },
  { id: "EMP-7143", name: "Tunde Fashola", ministry: "Health", fraudType: "Ghost Worker", riskScore: 95 },
  { id: "EMP-1189", name: "Kola Balogun", ministry: "Health", fraudType: "Ghost Worker", riskScore: 91 },
  { id: "EMP-2205", name: "Ngozi Eze", ministry: "Education", fraudType: "Duplicate Identity", riskScore: 88 },
  { id: "EMP-5912", name: "Emeka Obi", ministry: "Agriculture", fraudType: "Duplicate Identity", riskScore: 85 },
  { id: "EMP-4438", name: "Bola Ahmed", ministry: "Works", fraudType: "Salary Fraud", riskScore: 79 },
  { id: "EMP-6674", name: "Yemi Lawal", ministry: "Interior", fraudType: "Network Fraud", riskScore: 76 },
  { id: "EMP-9012", name: "Chioma Nwosu", ministry: "Finance", fraudType: "Salary Fraud", riskScore: 72 },
  { id: "EMP-8347", name: "Funke Akindele", ministry: "Education", fraudType: "Network Fraud", riskScore: 68 },
  { id: "EMP-3056", name: "Ade Sankore", ministry: "Works", fraudType: "Salary Fraud", riskScore: 63 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  return `₦${n.toLocaleString()}`;
}

function riskBadge(score: number) {
  if (score > 80)
    return { label: `${score}`, cls: "bg-gb-danger/15 text-gb-danger ring-1 ring-gb-danger/30" };
  return { label: `${score}`, cls: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25" };
}

// ─── Custom recharts elements ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string }) {
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

function PieLegend() {
  return (
    <ul className="mt-4 space-y-2">
      {PIE_DATA.map((d) => (
        <li key={d.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-sm text-white/70">{d.name}</span>
          </div>
          <span className="font-mono text-sm font-semibold text-white">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [filterType, setFilterType] = useState<FraudType | "All">("All");
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    const base = filterType === "All" ? EMPLOYEES : EMPLOYEES.filter((e) => e.fraudType === filterType);
    return [...base].sort((a, b) =>
      sortDesc ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
    );
  }, [filterType, sortDesc]);

  return (
    <div className="min-h-full bg-gb-bg px-4 py-6 space-y-7 sm:px-8 sm:py-10">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Analysis Results</h1>
          <p className="mt-1 text-sm text-gb-muted">
            March 2024 payroll audit — Federal Ministries &mdash; 10,000 records processed
          </p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gb-success px-5 py-2.5 text-sm font-semibold text-[#0A0F1E] transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Disburse to Verified Employees ({SUMMARY.clean.toLocaleString()})</span>
          <span className="sm:hidden">Disburse Verified ({SUMMARY.clean.toLocaleString()})</span>
        </button>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Total Employees"
          value={SUMMARY.total.toLocaleString()}
          sub="Registered in payroll"
          iconClass="text-gb-accent"
          iconBg="bg-gb-accent/10"
        />
        <SummaryCard
          icon={ShieldAlert}
          label="Flagged Records"
          value={SUMMARY.flagged.toLocaleString()}
          sub={`${((SUMMARY.flagged / SUMMARY.total) * 100).toFixed(1)}% of total`}
          iconClass="text-gb-danger"
          iconBg="bg-gb-danger/10"
          valueClass="text-gb-danger"
          border="border-gb-danger/15"
        />
        <SummaryCard
          icon={Banknote}
          label="Estimated Loss"
          value={formatNaira(SUMMARY.loss)}
          sub="Monthly payroll exposure"
          iconClass="text-gb-danger"
          iconBg="bg-gb-danger/10"
          valueClass="text-gb-danger"
          border="border-gb-danger/15"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Verified Clean"
          value={SUMMARY.clean.toLocaleString()}
          sub={`${((SUMMARY.clean / SUMMARY.total) * 100).toFixed(1)}% of total`}
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
                  data={PIE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {PIE_DATA.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <PieLegend />
        </div>

        {/* Bar chart */}
        <div className="col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 lg:col-span-3">
          <p className="text-sm font-semibold text-white">Flagged by Ministry</p>
          <p className="mt-0.5 text-xs text-gb-muted">Records requiring investigation</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={BAR_DATA}
                margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,0.06)"
                />
                <XAxis
                  dataKey="ministry"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="flagged" fill="#FF3B5C" radius={[4, 4, 0, 0]} name="Flagged" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Fraud network graph ──────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Fraud Network</h2>
            <p className="mt-0.5 text-xs text-gb-muted">Connections between flagged employees</p>
          </div>
          <span className="rounded-full bg-gb-accent/10 px-2.5 py-0.5 text-xs font-bold text-gb-accent">
            8 nodes
          </span>
        </div>
        <FraudNetworkGraph />
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
          {sortDesc ? (
            <TrendingDown className="h-3.5 w-3.5" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          Risk Score: {sortDesc ? "Highest first" : "Lowest first"}
        </button>

        <span className="ml-auto text-xs text-gb-muted">
          Showing {rows.length} of {SUMMARY.flagged.toLocaleString()} flagged records
        </span>
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
            {rows.map((emp, i) => {
              const badge = riskBadge(emp.riskScore);
              return (
                <tr
                  key={emp.id}
                  className={cn(
                    "border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]",
                    i === rows.length - 1 && "border-none"
                  )}
                >
                  {/* Employee */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{emp.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gb-muted">{emp.id}</p>
                  </td>

                  {/* Ministry */}
                  <td className="px-5 py-4 text-white/70">
                    Min. of {emp.ministry}
                  </td>

                  {/* Fraud type */}
                  <td className="px-5 py-4">
                    <FraudTypePill type={emp.fraudType} />
                  </td>

                  {/* Risk score */}
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums",
                        badge.cls
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-5 py-4">
                    <Link
                      href={`/case/${emp.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gb-accent/25 bg-gb-accent/10 px-3 py-1.5 text-xs font-semibold text-gb-accent transition-colors hover:bg-gb-accent/20"
                    >
                      View Case
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
            No records match the selected filter.
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

const FRAUD_PILL: Record<FraudType, string> = {
  "Ghost Worker": "bg-gb-danger/10 text-gb-danger ring-gb-danger/20",
  "Duplicate Identity": "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  "Salary Fraud": "bg-yellow-400/10 text-yellow-400 ring-yellow-400/20",
  "Network Fraud": "bg-purple-400/10 text-purple-400 ring-purple-400/20",
};

function FraudTypePill({ type }: { type: FraudType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        FRAUD_PILL[type]
      )}
    >
      {type}
    </span>
  );
}
