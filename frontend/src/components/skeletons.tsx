import { Skeleton } from "@/components/ui/skeleton";

// ─── ResultsSkeleton ──────────────────────────────────────────────────────────
// Mirrors: src/app/results/page.tsx
// Sections: page header, 4 summary cards, pie+bar charts, filter bar, 10-row table

export function ResultsSkeleton() {
  return (
    <div className="min-h-full bg-gb-bg px-8 py-10 space-y-7">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      {/* Summary cards — 2 cols mobile, 4 cols lg */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3"
          >
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Charts row — 5-col grid: pie (2) + bar (3) */}
      <div className="grid grid-cols-5 gap-4">

        {/* Pie chart card */}
        <div className="col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
          {/* Circle skeleton for pie */}
          <div className="mt-4 flex justify-center">
            <Skeleton className="h-[192px] w-[192px] rounded-full" />
          </div>
          {/* Legend items */}
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart card */}
        <div className="col-span-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-52" />
          {/* Bar chart body */}
          <div className="mt-4 flex h-64 items-end gap-4 px-2">
            {[185, 142, 121, 98, 167, 134].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <Skeleton
                  className="w-full rounded-t-sm"
                  style={{ height: `${Math.round((h / 185) * 70)}%` }}
                />
                <Skeleton className="h-2.5 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="ml-auto h-3.5 w-52" />
      </div>

      {/* Flagged employees table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-5 border-b border-white/[0.08] px-5 py-3.5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-20" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 items-center gap-4 border-b border-white/[0.05] px-5 py-4 last:border-none"
          >
            {/* Employee name + id */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            {/* Ministry */}
            <Skeleton className="h-4 w-28" />
            {/* Fraud type pill */}
            <Skeleton className="h-5 w-28 rounded-full" />
            {/* Risk badge */}
            <Skeleton className="h-5 w-10 rounded-full" />
            {/* Action button */}
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CaseSkeleton ─────────────────────────────────────────────────────────────
// Mirrors: src/app/case/[id]/page.tsx
// Sections: back link, 2-col grid (left: profile card + flags; right: gauge + connected + actions)

export function CaseSkeleton() {
  return (
    <div className="min-h-full bg-gb-bg px-8 py-10">

      {/* Back link */}
      <Skeleton className="mb-8 h-4 w-32" />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

        {/* ── Left column ───────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Profile card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />

              {/* Info */}
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-3.5 w-52" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>

                {/* Attribute grid — 3 cols */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-2.5 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Red flags */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4"
                >
                  <div className="flex items-start gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fraud network graph placeholder */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-[500px] w-full rounded-2xl" />
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Gauge card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
            <Skeleton className="h-3 w-28" />
            {/* Semicircle gauge — represented as a wide rounded rectangle */}
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-[110px] w-[220px] rounded-t-full rounded-b-none" />
              <Skeleton className="h-8 w-16 rounded" />
              {/* Fraud type pills */}
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            {/* Low/High risk bar */}
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-2.5 w-14" />
              </div>
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          </div>

          {/* Connected employees */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-5 w-6 rounded-full" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-2.5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="mx-auto mt-1 h-3 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
