"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Ghost,
  CloudUpload,
  FileText,
  X,
  Download,
  Loader,
  Check,
  CircleAlert,
  Network,
  Scan,
  ScanFace,
  FileSearch,
  CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "ready" | "analyzing" | "done" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYSIS_STEPS = [
  { icon: Scan, label: "Scanning attendance records" },
  { icon: ScanFace, label: "Checking biometric data" },
  { icon: Network, label: "Running network analysis" },
  { icon: FileSearch, label: "Generating fraud report" },
] as const;

const CSV_COLUMNS = [
  "Employee ID",
  "Name",
  "Ministry",
  "Grade Level",
  "Bank Account",
  "Monthly Salary",
  "NIN",
];

const SAMPLE_CSV = [
  "Employee ID,Name,Ministry,Grade Level,Bank Account,Monthly Salary,Status,NIN,Last Biometric",
  "EMP001,Adebayo Okafor,Ministry of Finance,GL-12,0123456789,450000,Active,12345678901,2024-01-15",
  "EMP002,Chidinma Nwosu,Ministry of Education,GL-08,9876543210,280000,Active,23456789012,2024-01-14",
  "EMP003,Ibrahim Musa,Ministry of Health,GL-14,1122334455,620000,Ghost,,",
  "EMP004,Folake Adeleke,Ministry of Works,GL-10,5544332211,380000,Active,45678901234,2024-01-16",
  "EMP005,Emeka Obi,Ministry of Agriculture,GL-06,6677889900,210000,Duplicate,56789012345,2024-01-10",
  "EMP006,Ngozi Eze,Ministry of Justice,GL-09,1234567890,330000,Active,67890123456,2024-01-15",
  "EMP007,Tunde Fashola,Ministry of Power,GL-15,0987654321,780000,Ghost,,",
  "EMP008,Amaka Okonkwo,Ministry of Interior,GL-07,1357924680,250000,Active,78901234567,2024-01-13",
].join("\n");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateRows(bytes: number): number {
  return Math.max(1, Math.round(bytes / 82));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const resetState = () => {
    setFile(null);
    setPhase("idle");
    setError(null);
    setProgress(0);
    setCurrentStep(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const validateAndSet = useCallback((f: File) => {
    setError(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError(
        `"${f.name}" is not a CSV file. Only .csv files are accepted for analysis.`
      );
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("File exceeds the 50 MB limit. Please split the payroll data.");
      return;
    }
    setFile(f);
    setPhase("ready");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) validateAndSet(dropped);
    },
    [validateAndSet]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSet(selected);
  };

  const startAnalysis = async () => {
    if (!file) return;
    setPhase("analyzing");
    setProgress(0);
    setCurrentStep(0);

    // Drive a smooth progress bar; step thresholds at 25% increments
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 0.7, 98);
        setCurrentStep(Math.min(3, Math.floor(next / 25)));
        return next;
      });
    }, 80);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      clearInterval(timerRef.current!);
      setProgress(100);
      setCurrentStep(3);
      setPhase("done");
    } catch (err) {
      clearInterval(timerRef.current!);
      setError(
        err instanceof Error ? err.message : "Analysis failed. Please retry."
      );
      setPhase("error");
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ghostbuster_sample_payroll.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const rowCount = file ? estimateRows(file.size) : 0;
  const isAnalyzing = phase === "analyzing";
  const isDone = phase === "done";

  return (
    <div className="min-h-full bg-gb-bg px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Upload Payroll Data
          </h1>
          <p className="mt-1 text-sm text-gb-muted">
            Upload your ministry&apos;s payroll CSV for AI-powered ghost worker
            and fraud detection.
          </p>
        </div>

        {/* ── Success banner ──────────────────────────────────────────────── */}
        {isDone && (
          <div className="flex items-center gap-3 rounded-xl border border-gb-success/25 bg-gb-success/10 px-5 py-4">
            <CircleCheck className="h-5 w-5 shrink-0 text-gb-success" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gb-success">
                Analysis complete
              </p>
              <p className="text-xs text-gb-muted mt-0.5">
                Results are ready. Navigate to Results to view flagged records.
              </p>
            </div>
            <button
              type="button"
              onClick={resetState}
              className="text-xs font-medium text-gb-muted hover:text-white transition-colors"
            >
              Upload another
            </button>
          </div>
        )}

        {/* ── Drop zone ───────────────────────────────────────────────────── */}
        {!isAnalyzing && !isDone && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload CSV file — click or drag and drop"
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onDrop}
            onClick={() => phase === "idle" && inputRef.current?.click()}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              phase === "idle" &&
              inputRef.current?.click()
            }
            className={cn(
              "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed",
              "px-8 py-16 text-center outline-none transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-gb-accent/60",
              dragOver
                ? "scale-[1.01] border-gb-accent bg-gb-accent/5"
                : phase === "ready"
                  ? "cursor-default border-gb-accent/40 bg-gb-accent/[0.04]"
                  : "cursor-pointer border-white/10 bg-white/[0.02] hover:border-gb-accent/40 hover:bg-gb-accent/[0.03]"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={onInputChange}
            />

            {phase === "ready" && file ? (
              /* ── File preview ── */
              <div className="w-full space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gb-accent/10 ring-1 ring-gb-accent/20">
                    <FileText className="h-6 w-6 text-gb-accent" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold text-white">
                      {file.name}
                    </p>
                    <p className="mt-0.5 text-sm text-gb-muted">
                      {formatBytes(file.size)}&ensp;&bull;&ensp;~
                      {rowCount.toLocaleString()} records estimated
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetState();
                    }}
                    className="rounded-md p-1 text-gb-muted transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Expected columns */}
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gb-muted">
                    Detected columns will be matched against
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CSV_COLUMNS.map((col) => (
                      <span
                        key={col}
                        className="rounded-md bg-gb-accent/10 px-2 py-0.5 font-mono text-[11px] text-gb-accent"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Empty drop zone ── */
              <>
                <div
                  className={cn(
                    "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-200",
                    dragOver
                      ? "border-gb-accent/50 bg-gb-accent/15"
                      : "border-white/10 bg-white/5"
                  )}
                >
                  {dragOver ? (
                    <CloudUpload className="h-7 w-7 text-gb-accent" />
                  ) : (
                    <Ghost className="h-7 w-7 text-gb-muted" />
                  )}
                </div>

                <p className="text-base font-semibold text-white">
                  {dragOver
                    ? "Release to upload"
                    : "Drag & drop your payroll CSV"}
                </p>
                <p className="mt-1.5 text-sm text-gb-muted">
                  or{" "}
                  <span className="text-gb-accent underline underline-offset-2">
                    browse files
                  </span>
                  &ensp;&mdash;&ensp;.csv only, max 50 MB
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {error && phase !== "analyzing" && (
          <div className="flex items-start gap-3 rounded-xl border border-gb-danger/20 bg-gb-danger/10 px-4 py-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gb-danger" />
            <p className="text-sm text-gb-danger">{error}</p>
          </div>
        )}

        {/* ── Analysis progress panel ─────────────────────────────────────── */}
        {isAnalyzing && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-white">AI Analysis Running</p>
                <p className="mt-0.5 text-sm text-gb-muted">
                  Processing&ensp;~{rowCount.toLocaleString()}&ensp;employee
                  records…
                </p>
              </div>
              <span className="font-mono text-2xl font-bold text-gb-accent tabular-nums">
                {Math.floor(progress)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gb-accent transition-all duration-150 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step list */}
            <div className="space-y-1.5">
              {ANALYSIS_STEPS.map(({ icon: Icon, label }, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-300",
                      active
                        ? "bg-gb-accent/10"
                        : done
                          ? "opacity-60"
                          : "opacity-25"
                    )}
                  >
                    {/* Step icon */}
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        done
                          ? "bg-gb-success/20 text-gb-success"
                          : active
                            ? "bg-gb-accent/20 text-gb-accent"
                            : "bg-white/5 text-white/30"
                      )}
                    >
                      {done ? (
                        <Check className="h-3 w-3" />
                      ) : active ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </div>

                    <span
                      className={cn(
                        "flex-1",
                        done
                          ? "text-gb-muted line-through"
                          : active
                            ? "font-medium text-white"
                            : "text-white/30"
                      )}
                    >
                      {label}
                    </span>

                    {active && (
                      <span className="animate-pulse text-xs text-gb-accent">
                        Running…
                      </span>
                    )}
                    {done && (
                      <span className="text-xs text-gb-success">Done</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Action buttons ──────────────────────────────────────────────── */}
        {!isAnalyzing && (
          <div className="flex items-center gap-3">
            {phase === "ready" && (
              <button
                type="button"
                onClick={startAnalysis}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gb-accent px-6 py-3 text-sm font-semibold text-gb-bg transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Scan className="h-4 w-4" />
                Analyze Payroll
              </button>
            )}

            <button
              type="button"
              onClick={downloadSample}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium",
                "text-gb-muted transition-colors hover:border-white/20 hover:text-white",
                phase !== "ready" && "flex-1 justify-center"
              )}
            >
              <Download className="h-4 w-4" />
              Download Sample CSV
            </button>
          </div>
        )}

        {/* ── CSV format reference ────────────────────────────────────────── */}
        {phase === "idle" && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gb-muted">
              Required CSV Format
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {CSV_COLUMNS.map((h) => (
                      <th
                        key={h}
                        className="pb-2 pr-4 text-left font-mono font-medium text-gb-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      "EMP001",
                      "A. Okafor",
                      "Finance",
                      "GL-12",
                      "012345…",
                      "450,000",
                      "12345…",
                    ].map((v, i) => (
                      <td
                        key={i}
                        className="py-2 pr-4 font-mono text-white/40"
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
