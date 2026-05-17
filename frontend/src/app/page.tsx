"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shield, Banknote, BarChart3, Sun, Moon, Zap, ArrowRight } from "lucide-react";

export default function HomePage() {
  // Matches layout.tsx which hardcodes class="dark" — no hydration flash.
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    setIsDark(next);
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-50 px-4 py-12 dark:bg-gb-bg sm:px-8 sm:py-16">

      {/* ── Background: faint grid ──────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0
          bg-[linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.04)_1px,transparent_1px)]
          dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]
          bg-[size:44px_44px]"
      />

      {/* ── Background: radial accent glow ─────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gb-accent/5 blur-3xl dark:bg-gb-accent/8"
      />

      {/* ── Theme toggle ───────────────────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Toggle light/dark mode"
        onClick={toggleTheme}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-800 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gb-muted dark:hover:bg-white/[0.08] dark:hover:text-white sm:right-6 sm:top-6"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-2xl pt-8 text-center sm:pt-10">

        {/* Live-system badge */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gb-accent/25 bg-gb-accent/10 px-3.5 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gb-accent opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gb-accent" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gb-accent">
            Live Detection System
          </span>
        </div>

        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Nigeria loses{" "}
          <span className="text-gb-danger">₦2.2 billion</span>{" "}
          annually to ghost workers
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-lg text-slate-600 dark:text-gb-muted">
          GhostBuster detects payroll fraud in seconds — not months
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-gb-accent px-6 py-3 text-sm font-bold text-gb-bg transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Zap className="h-4 w-4" />
            Start Analysis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
          >
            View Cases
          </Link>
        </div>

      </div>

      {/* ── Feature cards ──────────────────────────────────────────────────── */}
      <div className="relative mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {(
          [
            {
              icon: Shield,
              title: "AI Detection",
              description:
                "Multi-layer fraud scoring across biometrics, attendance records, salary anomalies, and relationship networks.",
              color: "text-gb-accent",
              bg: "bg-gb-accent/10",
            },
            {
              icon: Banknote,
              title: "Squad Payments",
              description:
                "Direct disbursement to verified employees via Squad Gateway — flagged records are skipped automatically.",
              color: "text-gb-success",
              bg: "bg-gb-success/10",
            },
            {
              icon: BarChart3,
              title: "Analytics",
              description:
                "Ministry-level fraud rate breakdown, fraud network graphs, and exportable audit-ready CSV reports.",
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
          ] as const
        ).map(({ icon: Icon, title, description, color, bg }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <div
              className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}
            >
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-gb-muted">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
