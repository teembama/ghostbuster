"use client";

import { useState } from "react";
import { Activity, Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { HeaderDate } from "./header-date";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gb-border bg-gb-sidebar px-4 md:px-6">
          {/* Hamburger — mobile only */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-md p-1.5 text-gb-muted transition-colors hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-semibold uppercase tracking-widest text-gb-muted sm:block">
                GhostBuster
              </span>
              <span className="hidden text-gb-muted sm:block">/</span>
              <span className="text-xs text-white/70">Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <HeaderDate />

            <div className="hidden items-center gap-1.5 rounded-full border border-gb-success/25 bg-gb-success/10 px-3 py-1 sm:flex">
              <Activity className="h-3 w-3 text-gb-success" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gb-success">
                System Active
              </span>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gb-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gb-success" />
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
