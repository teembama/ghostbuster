"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ghost, Upload, BarChart2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/results", label: "Results", icon: BarChart2 },
  { href: "/cases", label: "Cases", icon: Briefcase },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-gb-sidebar border-r border-gb-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gb-accent/10 ring-1 ring-gb-accent/30">
          <Ghost className="h-5 w-5 text-gb-accent" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-widest text-white uppercase">
            GhostBuster
          </p>
          <p className="text-[10px] text-gb-muted tracking-wide">
            Fraud Detection System
          </p>
        </div>
      </div>

      <div className="mx-4 h-px bg-gb-border" />

      {/* Ministry label */}
      <div className="px-6 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gb-muted">
          Navigation
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-gb-accent/10 text-gb-accent ring-1 ring-inset ring-gb-accent/20"
                  : "text-gb-muted hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-gb-accent" : "text-gb-muted group-hover:text-white"
                )}
              />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gb-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mx-4 h-px bg-gb-border" />
      <div className="px-6 py-4">
        <p className="text-[10px] text-gb-muted leading-relaxed">
          Federal Republic of Nigeria
          <br />
          Ministry of Finance
        </p>
      </div>
    </aside>
  );
}
