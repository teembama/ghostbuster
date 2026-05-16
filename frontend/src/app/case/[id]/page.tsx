"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
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
  CreditCard,
  Calendar,
  OctagonAlert,
  TriangleAlert,
  Zap,
  ShieldX,
  ShieldCheck,
  Gavel,
  UserRound,
  ShieldUser,
  CheckCircle,
  Loader,
  CircleAlert,
  Fingerprint,
  Network,
  TrendingUp,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getEmployee,
  type Employee,
  type RedFlag,
  type FlagSeverity,
  type FlagType,
} from "@/lib/api";
import { downloadCSV } from "@/lib/csv";
import { friendlyApiError } from "@/lib/errors";

// ─── Severity config ──────────────────────────────────────────────────────────

type DisplaySeverity = "critical" | "high" | "medium";

// Backend severity (LOW/MEDIUM/HIGH) → existing UI severity styling.
function mapSeverity(s: FlagSeverity): DisplaySeverity {
  if (s === "HIGH") return "critical";
  if (s === "MEDIUM") return "high";
  return "medium";
}

const SEV_CONFIG: Record<
  DisplaySeverity,
  { label: string; border: string; bg: string; text: string; dot: string; Icon: React.ComponentType<{ className?: string }> }
> = {
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

const FLAG_ICON: Record<FlagType, React.ComponentType<{ className?: string }>> = {
  BIOMETRIC: Fingerprint,
  ATTENDANCE: Calendar,
  SALARY: TrendingUp,
  NETWORK: Network,
};

const CLASSIFICATION_BADGE = {
  HIGH_RISK: { label: "HIGH RISK", cls: "border-gb-danger/25 bg-gb-danger/10 text-gb-danger" },
  REVIEW_REQUIRED: { label: "REVIEW", cls: "border-orange-500/25 bg-orange-500/10 text-orange-400" },
  VERIFIED: { label: "VERIFIED", cls: "border-gb-success/25 bg-gb-success/10 text-gb-success" },
} as const;

// ─── Fraud probability bar ────────────────────────────────────────────────────

function FraudProbabilityBar({ pct, fraudTypes }: { pct: number; fraudTypes: string[] }) {
  // Color thresholds per spec: <40 green, 40-69 amber, >=70 red.
  const tone =
    pct >= 70
      ? { bar: "bg-gb-danger", text: "text-gb-danger", ring: "ring-gb-danger/25" }
      : pct >= 40
        ? { bar: "bg-orange-500", text: "text-orange-400", ring: "ring-orange-500/25" }
        : { bar: "bg-gb-success", text: "text-gb-success", ring: "ring-gb-success/25" };

  const width = Math.max(0, Math.min(100, pct));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-5xl font-bold tracking-tight tabular-nums", tone.text)}>
          {Math.round(pct)}
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-gb-muted">
          Fraud Probability Score
        </span>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Fraud probability score"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone.bar)}
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-gb-muted">
        <span>0 — Low Risk</span>
        <span>100 — High Risk</span>
      </div>

      {fraudTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {fraudTypes.map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-full border bg-white/[0.04] px-3 py-0.5 text-xs font-semibold ring-1",
                tone.text,
                tone.ring,
                "border-transparent",
              )}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Action buttons (UI-only — no backend write endpoints) ───────────────────

type ActionState = "idle" | "loading" | "done";

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
      {state === "done" ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      {state === "loading" ? "Processing…" : state === "done" ? "Action Recorded" : label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fraudTypesFromFlags(flags: RedFlag[]): string[] {
  const types = new Set<string>();
  for (const f of flags) {
    if (f.type === "BIOMETRIC" || f.type === "ATTENDANCE") types.add("Ghost Worker");
    else if (f.type === "NETWORK") types.add("Network Fraud");
    else if (f.type === "SALARY") types.add("Salary Fraud");
  }
  return Array.from(types);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; employee: Employee }
  | { kind: "error"; message: string };

export default function CasePage() {
  return (
    <Suspense>
      <CasePageInner />
    </Suspense>
  );
}

function CasePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const uploadIdParam = searchParams.get("upload_id");
  const backHref = uploadIdParam ? `/results?upload_id=${encodeURIComponent(uploadIdParam)}` : "/results";

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({
    ghost: "idle",
    clear: "idle",
    escalate: "idle",
  });

  useEffect(() => {
    if (!id) {
      setState({ kind: "error", message: "Missing employee id." });
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const emp = await getEmployee(id);
        if (!cancelled) setState({ kind: "ready", employee: emp });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: friendlyApiError(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleAction(key: string) {
    // No backend write endpoint yet — local optimistic only.
    setActionStates((s) => ({ ...s, [key]: "loading" }));
    setTimeout(() => setActionStates((s) => ({ ...s, [key]: "done" })), 1400);
  }

  function handleDownloadCase(emp: Employee) {
    // Header row + one row per red flag (or a single placeholder row when there
    // are no flags) so the CSV always includes the employee summary.
    const baseCols = [
      emp.id,
      emp.name,
      emp.ministry,
      String(emp.salary),
      emp.classification,
      String(emp.fraud_score),
    ];
    const header = [
      "id",
      "name",
      "ministry",
      "salary",
      "classification",
      "fraud_score",
      "flag_type",
      "flag_severity",
      "flag_description",
      "flag_evidence",
    ];
    const flags = emp.red_flags ?? [];
    const rows: string[][] =
      flags.length === 0
        ? [header, [...baseCols, "", "", "", ""]]
        : [
            header,
            ...flags.map((f) => [
              ...baseCols,
              f.type,
              f.severity,
              f.description,
              f.evidence,
            ]),
          ];
    downloadCSV(`ghostbuster-case-${emp.id}.csv`, rows);
  }

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-full items-center justify-center bg-gb-bg p-8">
        <div className="flex items-center gap-3 text-sm text-gb-muted">
          <Loader className="h-4 w-4 animate-spin text-gb-accent" />
          Loading case…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="min-h-full bg-gb-bg px-4 py-12 sm:px-8">
        <Link href={backHref} className="mb-8 inline-flex items-center gap-2 text-sm text-gb-muted hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Results
        </Link>
        <div className="mx-auto max-w-xl rounded-2xl border border-gb-danger/25 bg-gb-danger/5 p-8 text-center space-y-3">
          <CircleAlert className="mx-auto h-8 w-8 text-gb-danger" />
          <p className="text-sm text-gb-muted break-words">{state.message}</p>
        </div>
      </div>
    );
  }

  const emp = state.employee;
  const classBadge = CLASSIFICATION_BADGE[emp.classification];
  const fraudPct = Math.round(emp.fraud_score);
  const fraudTypes = fraudTypesFromFlags(emp.red_flags ?? []);
  const isFlagged = emp.classification !== "VERIFIED";

  return (
    <div className="min-h-full bg-gb-bg px-4 py-6 sm:px-8 sm:py-10">
      <Link href={backHref} className="mb-8 inline-flex items-center gap-2 text-sm text-gb-muted transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Back to Results
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Profile card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <div className="flex items-start gap-5">

              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold",
                    isFlagged
                      ? "bg-gb-danger/10 ring-2 ring-gb-danger/30 text-gb-danger"
                      : "bg-gb-success/10 ring-2 ring-gb-success/30 text-gb-success"
                  )}
                >
                  {initialsOf(emp.name)}
                </div>
                {isFlagged && (
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gb-danger ring-2 ring-gb-bg">
                    <OctagonAlert className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-bold text-white">{emp.name || "—"}</h1>
                    <p className="mt-0.5 text-sm text-gb-muted">{emp.ministry || "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadCase(emp)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
                      aria-label="Download case CSV"
                    >
                      <Download className="h-3 w-3" />
                      Download Case
                    </button>
                    <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", classBadge.cls)}>
                      {classBadge.label}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {[
                    { icon: IdCard, label: "Employee ID", value: emp.id.slice(0, 12) },
                    { icon: Building2, label: "Ministry", value: emp.ministry || "—" },
                    { icon: Banknote, label: "Monthly Salary", value: `₦${emp.salary.toLocaleString()}` },
                    { icon: CreditCard, label: "Bank Account", value: `${emp.bank_name || "—"} ${emp.bank_account ? `· ${emp.bank_account}` : ""}` },
                    { icon: Calendar, label: "Date Joined", value: emp.employment_date || "—" },
                    { icon: UserRound, label: "Attendance Rate", value: `${emp.attendance_rate.toFixed(1)}%` },
                    { icon: ShieldUser, label: "Biometric ID", value: emp.biometric_id || "Not enrolled" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label}>
                      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gb-muted">
                        <Icon className="h-3 w-3" />
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-white truncate">{value}</dd>
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
                {emp.red_flags?.length ?? 0} {emp.red_flags?.length === 1 ? "issue" : "issues"}
              </span>
            </div>

            {emp.red_flags && emp.red_flags.length > 0 ? (
              <div className="space-y-3">
                {emp.red_flags.map((flag, i) => {
                  const sev = SEV_CONFIG[mapSeverity(flag.severity)];
                  const Icon = FLAG_ICON[flag.type] ?? sev.Icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-xl border-l-4 p-4 transition-colors",
                        sev.border,
                        sev.bg,
                        "border border-white/[0.05]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 shrink-0", sev.text)}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{flag.description}</p>
                            <span
                              className={cn("shrink-0 rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider", sev.text)}
                              style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                            >
                              <span className={cn("inline-flex items-center gap-1", sev.text)}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", sev.dot)} />
                                {sev.label}
                              </span>
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-gb-muted">{flag.evidence}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6 text-center text-sm text-gb-muted">
                No red flags detected for this employee.
              </div>
            )}
          </div>

          {/* Fraud network graph */}
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">Fraud Network</h2>
            </div>
            <FraudNetworkGraph />
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-5">

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gb-muted">
              AI Risk Assessment
            </p>
            <FraudProbabilityBar pct={fraudPct} fraudTypes={fraudTypes} />
          </div>

          {/* Action buttons — UI-only until backend exposes case actions */}
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
              Actions are local-only until backend write endpoints exist.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
