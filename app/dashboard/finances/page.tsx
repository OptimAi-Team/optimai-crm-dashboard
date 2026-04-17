"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  useFinancialData,
  todayRange,
  last7DaysRange,
  last30DaysRange,
  thisMonthRange,
  lastMonthRange,
  thisQuarterRange,
  thisYearRange,
  allTimeRange,
  type DateRange,
  type Transaction,
} from "./hooks/useFinancialData";
import { MetricCard }        from "./components/MetricCard";
import { CashFlowChart }     from "./components/CashFlowChart";
import { ExpenseByCategory } from "./components/ExpenseByCategory";
import { IncomeByClient }    from "./components/IncomeByClient";
import { AIInsights }        from "./components/AIInsights";
import { TransactionTable }      from "./components/TransactionTable";
import { AddTransactionModal }   from "./components/AddTransactionModal";
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
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// UI components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Date filter presets ──────────────────────────────────────────────────────

type FilterKey = 
  | "today"
  | "last-7d"
  | "last-30d"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "this-year"
  | "all-time"
  | "custom";

interface FilterPreset {
  key: FilterKey;
  label: string;
  description?: string;
  range: (transactions?: Transaction[]) => DateRange;
}

// TypeScript type safety with Record
const DATE_RANGE_FUNCTIONS: Record<Exclude<FilterKey, "custom">, (transactions?: Transaction[]) => DateRange> = {
  "today": todayRange,
  "last-7d": last7DaysRange,
  "last-30d": last30DaysRange,
  "this-month": thisMonthRange,
  "last-month": lastMonthRange,
  "this-quarter": thisQuarterRange,
  "this-year": thisYearRange,
  "all-time": allTimeRange,
};

const PRESETS: FilterPreset[] = [
  { key: "today",       label: "Today",       range: DATE_RANGE_FUNCTIONS["today"] },
  { key: "last-7d",     label: "Last 7 days", range: DATE_RANGE_FUNCTIONS["last-7d"] },
  { key: "last-30d",    label: "Last 30 days", range: DATE_RANGE_FUNCTIONS["last-30d"] },
  { key: "this-month",  label: "This month",  range: DATE_RANGE_FUNCTIONS["this-month"] },
  { key: "last-month",  label: "Last month",  range: DATE_RANGE_FUNCTIONS["last-month"] },
  { key: "this-quarter", label: "This quarter", range: DATE_RANGE_FUNCTIONS["this-quarter"] },
  { key: "this-year",   label: "This year",   range: DATE_RANGE_FUNCTIONS["this-year"] },
  { key: "all-time",    label: "All time",    range: DATE_RANGE_FUNCTIONS["all-time"] },
];

// Storage key for persisted filter preference
const FILTER_STORAGE_KEY = 'finances-filter-preference';

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

/**
 * Generate a human-readable date range description
 */
function formatDateRangeDescription(range: DateRange, filterKey: FilterKey): string {
  const dateFormat: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric"
  };
  
  const from = range.from.toLocaleDateString("en-US", dateFormat);
  const to = range.to.toLocaleDateString("en-US", dateFormat);
  
  return `${from} – ${to}`;
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("last-30d");
  const [dateRange, setDateRange] = useState<DateRange>(last30DaysRange());
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [showCustom, setShowCustom] = useState(false);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

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

  // Set all transactions for use with allTimeRange
  useEffect(() => {
    if (!loading && transactions?.length > 0) {
      setAllTransactions(transactions);
    }
  }, [transactions, loading]);

  // Load saved filter preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
        if (savedFilter && Object.keys(DATE_RANGE_FUNCTIONS).includes(savedFilter)) {
          const filterKey = savedFilter as FilterKey;
          setActiveFilter(filterKey);
          setDateRange(DATE_RANGE_FUNCTIONS[filterKey as keyof typeof DATE_RANGE_FUNCTIONS](allTransactions));
        }
      } catch (err) {
        console.error('Error loading saved filter preference:', err);
      }
    }
  }, [allTransactions]);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    router.push("/login");
    return null;
  }

  const handlePreset = useCallback((preset: FilterPreset) => {
    setActiveFilter(preset.key);
    setDateRange(preset.range(allTransactions));
    setShowCustom(false);

    // Save preference to localStorage
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, preset.key);
    } catch (err) {
      console.error('Error saving filter preference:', err);
    }
  }, [allTransactions]);

  const applyCustomRange = useCallback(() => {
    if (!customFrom || !customTo) return;
    
    const range = {
      // Append local-time suffix so JS parses in local time, not UTC.
      // "2026-04-01" alone parses as UTC midnight → March 31 at 4pm in PT.
      // "2026-04-01T00:00:00" parses as local midnight → April 1 at 12am PT.
      from: new Date(customFrom + "T00:00:00"),
      to:   new Date(customTo + "T23:59:59"),
    };
    
    setDateRange(range);
    setActiveFilter("custom");
    setShowCustom(false);
    
    // Custom ranges aren't saved to localStorage
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
                <span className="font-medium">{PRESETS.find(p => p.key === activeFilter)?.label || "Custom Range"}: </span>
                {formatDateRangeDescription(dateRange, activeFilter)}
              </p>
            </div>
          </div>

          {/* Right: filters + refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Range Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{PRESETS.find(p => p.key === activeFilter)?.label || "Custom"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  {PRESETS.map((preset) => (
                    <DropdownMenuItem 
                      key={preset.key} 
                      onClick={() => handlePreset(preset)}
                      className={cn(
                        "cursor-pointer",
                        activeFilter === preset.key && "font-medium bg-secondary/50"
                      )}
                    >
                      {preset.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem 
                    onClick={() => setShowCustom(true)}
                    className={cn(
                      "cursor-pointer",
                      activeFilter === "custom" && "font-medium bg-secondary/50"
                    )}
                  >
                    Custom Range
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

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
            <div className="flex flex-col gap-1">
              <label htmlFor="date-from" className="text-xs text-muted-foreground">From date</label>
              <Input
                id="date-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || toInputDate(new Date())}
                className="h-9 w-44 bg-secondary border-border text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="date-to" className="text-xs text-muted-foreground">To date</label>
              <Input
                id="date-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
                max={toInputDate(new Date())}
                className="h-9 w-44 bg-secondary border-border text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <Button
                size="sm"
                onClick={applyCustomRange}
                disabled={!customFrom || !customTo}
                className="h-9"
              >
                Apply
              </Button>
            </div>
            <button
              onClick={() => setShowCustom(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-auto mb-1"
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
          {loading ? (
            <TableSkeleton />
          ) : (
            <TransactionTable
              transactions={transactions}
              onAddTransaction={() => setShowAddModal(true)}
            />
          )}
        </section>
      </main>

      <AddTransactionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={refetch}
      />
    </div>
  );
}