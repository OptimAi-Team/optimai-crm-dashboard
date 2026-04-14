"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  useFinancialData,
  last30DaysRange,
  thisMonthRange,
  lastNMonthsRange,
  ytdRange,
  type DateRange,
} from "./hooks/useFinancialData";
import { MetricCard }        from "./components/MetricCard";
import { CashFlowChart }     from "./components/CashFlowChart";
import { ExpenseByCategory } from "./components/ExpenseByCategory";
import { IncomeByClient }    from "./components/IncomeByClient";
import { AIInsights }        from "./components/AIInsights";
import { TransactionTable }  from "./components/TransactionTable";
import { Skeleton }          from "@/components/ui/skeleton";
import { Button }            from "@/components/ui/button";
import { Input }             from "@/components/ui/input";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Percent,
  Landmark,
  RefreshCw,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Date filter presets ──────────────────────────────────────────────────────

type FilterKey = "last-30d" | "this-month" | "last-3m" | "ytd" | "custom";

interface FilterPreset {
  key: FilterKey;
  label: string;
  range: () => DateRange;
}

const PRESETS: FilterPreset[] = [
  { key: "last-30d",   label: "Last 30D",   range: last30DaysRange },
  { key: "this-month", label: "This Month", range: thisMonthRange },
  { key: "last-3m",    label: "Last 3M",    range: () => lastNMonthsRange(3) },
  { key: "ytd",        label: "YTD",        range: ytdRange },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function toInputDate(d: Date): string {
  // Use local year/month/day — toISOString() shifts to UTC and returns
  // tomorrow's date for users east of UTC (e.g. UTC+9 at 11pm local).
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <Skeleton className="h-5 w-36 mb-2" />
      <Skeleton className="h-4 w-52 mb-6" />
      <Skeleton className="h-[260px] w-full rounded-lg" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-9 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancesDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeFilter, setActiveFilter] = useState<FilterKey>("last-30d");
  const [dateRange,    setDateRange]     = useState<DateRange>(last30DaysRange());
  const [customFrom,   setCustomFrom]    = useState<string>("");
  const [customTo,     setCustomTo]      = useState<string>("");
  const [showCustom,   setShowCustom]    = useState(false);

  const {
    metrics,
    cashFlow,
    expensesByCategory,
    incomeByClient,
    transactions,
    insights,
    loading,
    error,
    refetch,
  } = useFinancialData(dateRange);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    router.push("/login");
    return null;
  }

  const handlePreset = useCallback((preset: FilterPreset) => {
    setActiveFilter(preset.key);
    setDateRange(preset.range());
    setShowCustom(false);
  }, []);

  const applyCustomRange = useCallback(() => {
    if (!customFrom || !customTo) return;
    setDateRange({
      // Bug 3: append local-time suffix so JS parses in local time, not UTC.
      // "2026-04-01" alone parses as UTC midnight → March 31 at 4pm in PT.
      // "2026-04-01T00:00:00" parses as local midnight → April 1 at 12am PT.
      from: new Date(customFrom + "T00:00:00"),
      to:   new Date(customTo   + "T23:59:59"),
    });
    setActiveFilter("custom");
    setShowCustom(false);
  }, [customFrom, customTo]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: back + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-none">
                Financial Dashboard
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" – "}
                {dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Right: filters + refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Preset buttons */}
            <div className="flex items-center bg-secondary rounded-lg p-1 gap-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                    activeFilter === p.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                  activeFilter === "custom"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                Custom
              </button>
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
              className="h-9 gap-1.5"
              aria-label="Refresh data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Custom date picker */}
        {showCustom && (
          <div className="mt-3 flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-2 duration-200">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              max={customTo || toInputDate(new Date())}
              className="h-9 w-40 bg-secondary border-border text-sm"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              min={customFrom}
              max={toInputDate(new Date())}
              className="h-9 w-40 bg-secondary border-border text-sm"
            />
            <Button
              size="sm"
              onClick={applyCustomRange}
              disabled={!customFrom || !customTo}
              className="h-9"
            >
              Apply
            </Button>
            <button
              onClick={() => setShowCustom(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="p-6 space-y-6">
        {/* Error banner */}
        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-5 py-4 text-sm animate-in fade-in duration-300">
            {error} —{" "}
            <button
              onClick={refetch}
              className="underline underline-offset-2 hover:no-underline"
            >
              try again
            </button>
          </div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <section aria-label="Key financial metrics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <MetricSkeleton key={i} />)
            ) : (
              <>
                <MetricCard
                  title="Total Income"
                  value={fmt(metrics.totalRevenue)}
                  change={metrics.revenueChange}
                  changeLabel="vs prior period"
                  icon={DollarSign}
                  iconColor="#10b981"
                  delay={0}
                  highlight
                />
                <MetricCard
                  title="Total Expenses"
                  value={fmt(metrics.totalExpenses)}
                  change={metrics.expenseChange}
                  changeLabel="vs prior period"
                  icon={TrendingDown}
                  iconColor="#ef4444"
                  delay={1}
                />
                <MetricCard
                  title="Net Profit"
                  value={fmt(metrics.netProfit)}
                  change={metrics.profitChange}
                  changeLabel="vs prior period"
                  icon={TrendingUp}
                  iconColor="#3b82f6"
                  delay={2}
                />
                <MetricCard
                  title="Profit Margin"
                  value={`${metrics.profitMargin.toFixed(1)}%`}
                  change={0}
                  icon={Percent}
                  iconColor="#8b5cf6"
                  delay={3}
                />
                <MetricCard
                  title="Cash Balance"
                  value={fmt(metrics.cashBalance ?? 0)}
                  change={0}
                  icon={Landmark}
                  iconColor="#a855f7"
                  delay={4}
                />
              </>
            )}
          </div>
        </section>

        {/* ── Charts 2×2 ────────────────────────────────────────────────────── */}
        <section aria-label="Financial charts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loading ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
                <ChartSkeleton />
                <div className="bg-card border border-border rounded-xl p-5">
                  <Skeleton className="h-5 w-36 mb-2" />
                  <Skeleton className="h-4 w-52 mb-6" />
                  <div className="flex items-center justify-center h-[260px] rounded-lg border border-border border-dashed">
                    <span className="text-muted-foreground text-sm">Coming soon</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Top-left: Cash Flow */}
                <CashFlowChart data={cashFlow} />

                {/* Top-right: Expense Breakdown */}
                <ExpenseByCategory data={expensesByCategory} />

                {/* Bottom-left: Income by Client */}
                <IncomeByClient data={incomeByClient} />

                {/* Bottom-right: Placeholder for future chart */}
                <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 flex flex-col">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Profit Trend
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Month-over-month net profit
                  </p>
                  <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border">
                    <div className="text-center space-y-2 py-8">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto">
                        <TrendingUp className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Profit trend chart
                        <br />
                        <span className="text-xs">Coming in next release</span>
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── AI Insights ───────────────────────────────────────────────────── */}
        <section aria-label="AI financial insights">
          {loading ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <AIInsights insights={insights} />
          )}
        </section>

        {/* ── Transactions ──────────────────────────────────────────────────── */}
        <section aria-label="Transaction history">
          {/* Cleanup 2: removed .slice(0,50) and dead "View all" no-op button.
              TransactionTable has its own 15-row pagination — the slice was redundant. */}
          {loading ? (
            <TableSkeleton />
          ) : (
            <TransactionTable transactions={transactions} />
          )}
        </section>
      </main>
    </div>
  );
}
