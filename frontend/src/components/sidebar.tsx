"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ghost, Upload, BarChart2, Briefcase, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/results", label: "Results", icon: BarChart2 },
  { href: "/cases", label: "Cases", icon: Briefcase },
] as const;

export function Sidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-gb-sidebar border-r border-gb-border",
        "transition-transform duration-300 ease-in-out",
        "lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Logo + mobile close button */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gb-accent/10 ring-1 ring-gb-accent/30">
          <Ghost className="h-5 w-5 text-gb-accent" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-widest text-white uppercase">
            GhostBuster
          </p>
          <p className="text-[10px] text-gb-muted tracking-wide">
            Fraud Detection System
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-md p-1 text-gb-muted transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
              onClick={onClose}
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
