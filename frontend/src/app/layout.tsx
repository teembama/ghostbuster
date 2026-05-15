import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Activity } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { HeaderDate } from "@/components/header-date";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GhostBuster — Payroll Fraud Detection",
  description:
    "AI-powered government payroll fraud detection system for Nigerian federal ministries.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex h-full bg-gb-bg text-white">
        {/* Left sidebar */}
        <Sidebar />

        {/* Main content column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-gb-border bg-gb-sidebar px-6">
            {/* Left: breadcrumb placeholder */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-gb-muted">
                GhostBuster
              </span>
              <span className="text-gb-border text-gb-muted">/</span>
              <span className="text-xs text-white/70">Dashboard</span>
            </div>

            {/* Right: status + date */}
            <div className="flex items-center gap-5">
              <HeaderDate />

              {/* System Active badge */}
              <div className="flex items-center gap-1.5 rounded-full border border-gb-success/25 bg-gb-success/10 px-3 py-1">
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

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
