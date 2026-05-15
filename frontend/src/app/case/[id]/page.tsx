"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";

const FraudNetworkGraph = dynamic(
  () => import("@/components/FraudNetworkGraph"),
  { ssr: false }
);
import {
  ArrowLeft,
  Building2,
  IdCard,
  Banknote,
  Phone,
  CreditCard,
  Clock,
  Calendar,
  Link2,
  OctagonAlert,
  TriangleAlert,
  Zap,
  ShieldX,
  ShieldCheck,
  Gavel,
  UserRound,
  ShieldUser,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium";
type ActionState = "idle" | "loading" | "done";

// ─── Mock data ────────────────────────────────────────────────────────────────

const EMPLOYEE = {
  name: "Chukwuemeka Obi",
  initials: "CO",
  id: "FMF-2024-04821",
  ministry: "Federal Ministry of Finance",
  role: "Senior Accountant",
  grade: "Grade Level 12",
  salary: 485_000,
  fraudProbability: 94,
  fraudTypes: ["Ghost Worker", "Network Fraud"],
  department: "Revenue Management Division",
  dateJoined: "March 2017",
  lastSeen: "18 months ago",
};

const RED_FLAGS = [
  {
    id: 1,
    severity: "critical" as Severity,
    icon: FingerprintIcon,
    title: "No biometric records in IPPIS for 18 months",
    detail: "Employee has not been verified by IPPIS biometric system since June 2022.",
  },
  {
    id: 2,
    severity: "critical" as Severity,
    icon: CreditCard,
    title: "Bank account shared with 4 other employees",
    detail: "Account 0123-4567-89 (GTBank) is linked to EMP-1823, EMP-4410, EMP-7201, and EMP-9034.",
  },
  {
    id: 3,
    severity: "high" as Severity,
    icon: Calendar,
    title: "Attendance marked 100% for 24 consecutive months",
    detail: "Perfect attendance spanning Jan 2022 – Dec 2023 with zero sick days or leave days recorded.",
  },
  {
    id: 4,
    severity: "high" as Severity,
    icon: Banknote,
    title: "Salary increased 340% in 6 months with no promotion record",
    detail: "Base pay moved from ₦110,000 to ₦485,000 between Feb and Aug 2023. No HR promotion document found.",
  },
  {
    id: 5,
    severity: "medium" as Severity,
    icon: Phone,
    title: "Phone number linked to 7 other employee records",
    detail: "+234 802 XXX XXXX appears as primary contact on 7 separate IPPIS employee profiles.",
  },
];

const CONNECTED_EMPLOYEES = [
  { id: "EMP-1823", name: "Abiodun Salami", ministry: "Min. of Finance", link: "Shared bank account" },
  { id: "EMP-4410", name: "Obiageli Nwachukwu", ministry: "Min. of Finance", link: "Shared bank account" },
  { id: "EMP-7201", name: "Sule Maikano", ministry: "Min. of Finance", link: "Shared phone number" },
  { id: "EMP-9034", name: "Chiamaka Ezeh", ministry: "Min. of Education", link: "Shared NIN prefix" },
];

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severity, { label: string; border: string; bg: string; text: string; dot: string; Icon: React.ComponentType<{ className?: string }> }> = {
  critical: {
    label: "Critical",
    border: "border-l-gb-danger",
    bg: "bg-gb-danger/5",
    text: "text-gb-danger",
    dot: "bg-gb-danger",
    Icon: OctagonAlert,
  },
  high: {
    label: "High",
    border: "border-l-orange-500",
    bg: "bg-orange-500/5",
    text: "text-orange-400",
    dot: "bg-orange-500",
    Icon: TriangleAlert,
  },
  medium: {
    label: "Medium",
    border: "border-l-yellow-400",
    bg: "bg-yellow-400/5",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
    Icon: Zap,
  },
};

// ─── SVG gauge helpers ────────────────────────────────────────────────────────

function FingerprintIcon({ className }: { className?: string }) {
  return <ShieldUser className={className} />;
}

function gaugeArcPath(cx: number, cy: number, r: number, pct: number) {
  // Semicircle from left (180°) to right (0°) passing through the top.
  // sweep-flag=0 (counterclockwise in SVG = visually goes upward).
  const startX = cx - r;
  const startY = cy;
  const track = `M ${startX} ${startY} A ${r} ${r} 0 0 0 ${cx + r} ${startY}`;

  if (pct <= 0) return { track, fill: "" };
  if (pct >= 100) return { track, fill: track };

  // Angle of the fill endpoint (in standard math, measured from positive x-axis)
  // pct=0 → angle=π (left), pct=100 → angle=0 (right)
  const angle = (1 - pct / 100) * Math.PI;
  const ex = (cx + r * Math.cos(angle)).toFixed(3);
  const ey = (cy - r * Math.sin(angle)).toFixed(3); // minus because SVG y is inverted

  // large-arc-flag=0: the fill always spans < 180° for pct < 100
  const largeArc = pct > 50 ? 1 : 0;
  const fill = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 0 ${ex} ${ey}`;
  return { track, fill };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GaugeMeter({ pct }: { pct: number }) {
  const cx = 100, cy = 100, r = 82;
  const { track, fill } = gaugeArcPath(cx, cy, r, pct);
  const color = pct >= 80 ? "#FF3B5C" : pct >= 60 ? "#FF9500" : "#00C853";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 108"
        className="w-full max-w-[220px]"
        aria-label={`Fraud probability: ${pct}%`}
      >
        {/* Outer glow ring (decorative) */}
        <path
          d={track}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="28"
          strokeLinecap="round"
        />
        {/* Track */}
        <path
          d={track}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {/* Fill */}
        {fill && (
          <path
            d={fill}
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
          />
        )}
        {/* Percentage label */}
        <text
          x="100"
          y="88"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="38"
          fontWeight="800"
          fill={color}
          fontFamily="inherit"
          letterSpacing="-1"
        >
          {pct}%
        </text>
        {/* Sub-label */}
        <text
          x="100"
          y="106"
          textAnchor="middle"
          fontSize="10"
          fill="rgba(255,255,255,0.4)"
          fontFamily="inherit"
          letterSpacing="0.5"
        >
          FRAUD PROBABILITY
        </text>
      </svg>

      {/* Fraud type pills */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EMPLOYEE.fraudTypes.map((t) => (
          <span
            key={t}
            className="rounded-full border border-gb-danger/25 bg-gb-danger/10 px-3 py-0.5 text-xs font-semibold text-gb-danger"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  variant,
  onClick,
  state,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "danger" | "success" | "warning";
  onClick: () => void;
  state: ActionState;
}) {
  const base = "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]";
  const styles = {
    danger: "bg-gb-danger/15 text-gb-danger ring-1 ring-gb-danger/30 hover:bg-gb-danger/25",
    success: "bg-gb-success/15 text-gb-success ring-1 ring-gb-success/30 hover:bg-gb-success/25",
    warning: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30 hover:bg-orange-500/25",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading" || state === "done"}
      className={cn(base, styles[variant], (state === "loading" || state === "done") && "opacity-60 pointer-events-none")}
    >
      {state === "done" ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {state === "loading" ? "Processing…" : state === "done" ? "Action Recorded" : label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasePage() {
  const params = useParams();
  const id = (params?.id as string) ?? EMPLOYEE.id;

  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({
    ghost: "idle",
    clear: "idle",
    escalate: "idle",
  });

  function handleAction(key: string) {
    setActionStates((s) => ({ ...s, [key]: "loading" }));
    setTimeout(() => setActionStates((s) => ({ ...s, [key]: "done" })), 1400);
  }

  return (
    <div className="min-h-full bg-gb-bg px-4 py-6 sm:px-8 sm:py-10">
      {/* Back nav */}
      <Link
        href="/results"
        className="mb-8 inline-flex items-center gap-2 text-sm text-gb-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Results
      </Link>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Employee profile card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <div className="flex items-start gap-5">

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gb-danger/10 ring-2 ring-gb-danger/30 text-xl font-bold text-gb-danger">
                  {EMPLOYEE.initials}
                </div>
                {/* Flagged badge */}
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gb-danger ring-2 ring-gb-bg">
                  <OctagonAlert className="h-3 w-3 text-white" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-bold text-white">{EMPLOYEE.name}</h1>
                    <p className="mt-0.5 text-sm text-gb-muted">
                      {EMPLOYEE.role} &bull; {EMPLOYEE.grade}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gb-danger/25 bg-gb-danger/10 px-3 py-1 text-xs font-bold text-gb-danger">
                    FLAGGED
                  </span>
                </div>

                {/* Grid of attributes */}
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {[
                    { icon: IdCard, label: "Employee ID", value: EMPLOYEE.id },
                    { icon: Building2, label: "Ministry", value: EMPLOYEE.ministry },
                    { icon: UserRound, label: "Department", value: EMPLOYEE.department },
                    { icon: Banknote, label: "Monthly Salary", value: `₦${EMPLOYEE.salary.toLocaleString()}` },
                    { icon: Calendar, label: "Date Joined", value: EMPLOYEE.dateJoined },
                    { icon: Clock, label: "Last Verified", value: EMPLOYEE.lastSeen },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label}>
                      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gb-muted">
                        <Icon className="h-3 w-3" />
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          {/* Red flags */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Red Flags Detected</h2>
              <span className="rounded-full bg-gb-danger/10 px-2.5 py-0.5 text-xs font-bold text-gb-danger">
                {RED_FLAGS.length} issues
              </span>
            </div>

            <div className="space-y-3">
              {RED_FLAGS.map((flag) => {
                const sev = SEV_CONFIG[flag.severity];
                const Icon = flag.icon;
                return (
                  <div
                    key={flag.id}
                    className={cn(
                      "rounded-xl border-l-4 p-4 transition-colors",
                      sev.border,
                      sev.bg,
                      "border border-white/[0.05]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Severity icon */}
                      <div className={cn("mt-0.5 shrink-0", sev.text)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{flag.title}</p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider",
                              sev.text,
                              "bg-current/10"
                            )}
                            style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                          >
                            <span className={cn("inline-flex items-center gap-1", sev.text)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", sev.dot)} />
                              {sev.label}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-gb-muted">{flag.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fraud network graph */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Fraud Network</h2>
              <span className="rounded-full bg-gb-accent/10 px-2.5 py-0.5 text-xs font-bold text-gb-accent">
                8 nodes
              </span>
            </div>
            <FraudNetworkGraph />
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Fraud probability gauge */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gb-muted">
              AI Risk Assessment
            </p>
            <GaugeMeter pct={EMPLOYEE.fraudProbability} />

            {/* Risk bar labels */}
            <div className="mt-4 flex items-center justify-between text-[10px] text-gb-muted">
              <span>Low Risk</span>
              <span>High Risk</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gradient-to-r from-gb-success via-orange-500 to-gb-danger" />
          </div>

          {/* Connected employees */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-gb-accent" />
              <p className="text-sm font-semibold text-white">Connected Employees</p>
              <span className="ml-auto rounded-full bg-gb-accent/10 px-2 py-0.5 text-xs font-bold text-gb-accent">
                {CONNECTED_EMPLOYEES.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {CONNECTED_EMPLOYEES.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/case/${emp.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition-colors hover:border-gb-accent/20 hover:bg-gb-accent/5"
                >
                  {/* Mini avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-white">
                    {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{emp.name}</p>
                    <p className="truncate text-[11px] text-gb-muted">{emp.ministry}</p>
                  </div>

                  {/* Shared attribute */}
                  <span className="shrink-0 rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                    {emp.link}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-2.5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gb-muted">
              Case Actions
            </p>

            <ActionButton
              label="Mark as Ghost Worker"
              icon={ShieldX}
              variant="danger"
              state={actionStates.ghost}
              onClick={() => handleAction("ghost")}
            />
            <ActionButton
              label="Clear Employee"
              icon={ShieldCheck}
              variant="success"
              state={actionStates.clear}
              onClick={() => handleAction("clear")}
            />
            <ActionButton
              label="Escalate to ICPC"
              icon={Gavel}
              variant="warning"
              state={actionStates.escalate}
              onClick={() => handleAction("escalate")}
            />

            <p className="pt-1 text-center text-[10px] text-gb-muted">
              Actions are logged and sent to the audit trail
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
