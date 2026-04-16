"use client";

import { useState, useEffect, useCallback } from "react";
import { createClientSideClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAGS
//
// LIVE_MODE = false  → no Supabase calls; hook returns MOCK_TRANSACTIONS.
//                      Useful for local UI work without a DB connection.
//
// TABLE_HAS_USER_ID  → set false only if optimai_transactions has no user_id
//                      column (single-tenant table). Confirm with:
//                      SELECT column_name FROM information_schema.columns
//                      WHERE table_name = 'optimai_transactions';
// ─────────────────────────────────────────────────────────────────────────────

const LIVE_MODE         = true;
const TABLE_HAS_USER_ID = true;

const supabase = createClientSideClient();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

/** Mirrors optimai_transactions exactly. */
export interface Transaction {
  id: string;
  user_id?: string;
  transaction_date: string;
  description: string;
  amount: number;
  category: string;
  /**
   * INCOME  + EQUITY        → money in  (adds to P&L revenue and cash balance)
   * EXPENSE + OWNER DRAWING → money out (adds to P&L expenses and reduces cash)
   *
   * P&L uses INCOME/EXPENSE only.
   * Cash balance uses all four types.
   */
  type: "INCOME" | "EXPENSE" | "EQUITY" | "OWNER DRAWING";
  /** Maps directly to the `payee` column. Not `client_name`. */
  payee: string | null;
  is_deductible: boolean | null;
  notes: string | null;
  created_at: string;
}


export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  /** All-time running balance — includes EQUITY and OWNER DRAWING. */
  cashBalance: number;
  revenueChange: number;
  expenseChange: number;
  profitChange: number;
}

export interface CashFlowDataPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ExpenseCategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface IncomeClientData {
  /** Sourced from the `payee` column. */
  client: string;
  amount: number;
  transactions: number;
}

export interface AIInsight {
  type: "positive" | "warning" | "info";
  title: string;
  description: string;
  metric?: string;
}

export interface FinancialData {
  metrics: FinancialMetrics;
  cashFlow: CashFlowDataPoint[];
  expensesByCategory: ExpenseCategoryData[];
  incomeByClient: IncomeClientData[];
  transactions: Transaction[];
  insights: AIInsight[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE RANGE HELPERS  (exported — consumed by page.tsx for preset buttons)
// ─────────────────────────────────────────────────────────────────────────────

/** Today back 29 days — a rolling 30-day window ending right now. */
export function last30DaysRange(): DateRange {
  const to   = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function thisMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export function lastNMonthsRange(n: number): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - n + 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export function ytdRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a Date to YYYY-MM-DD in LOCAL time.
 *
 * toISOString() converts to UTC — a date at midnight in UTC-8 becomes the
 * previous calendar day. This function uses local year/month/day instead,
 * matching how transaction_date is stored (date only, no timezone).
 */
function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function filterByRange<T extends { transaction_date: string }>(
  rows: T[],
  range: DateRange,
): T[] {
  const from = toLocalDateStr(range.from);
  const to   = toLocalDateStr(range.to);
  // Slice to 10 chars: Supabase may return "2026-04-16T00:00:00" for date columns.
  // "2026-04-16T..." > "2026-04-16" in string order, so the upper-bound check
  // would silently drop any transaction whose date equals the range end.
  return rows.filter((r) => {
    const d = r.transaction_date.slice(0, 10);
    return d >= from && d <= to;
  });
}

/** Revenue = INCOME transactions only (P&L view). */
function sumIncome(txs: Array<{ type: string; amount: number }>): number {
  // Number() guards against Supabase returning numeric(12,2) as a string.
  // "1500.00" + "750.00" = "01500.00750.00" without the coercion.
  return txs.filter((t) => t.type === "INCOME").reduce((a, t) => a + Number(t.amount), 0);
}

/** Operating expenses = EXPENSE transactions only (P&L view). */
function sumExpenses(txs: Array<{ type: string; amount: number }>): number {
  return txs.filter((t) => t.type === "EXPENSE").reduce((a, t) => a + Number(t.amount), 0);
}

/**
 * All-time cash balance.
 *   INCOME  + EQUITY        → add to balance
 *   EXPENSE + OWNER DRAWING → subtract from balance
 *
 */
function runningCashBalance(txs: Array<{ type: string; amount: number }>): number {
  return txs.reduce((bal, t) => {
    const amt = Number(t.amount);
    if (t.type === "INCOME"  || t.type === "EQUITY")        return bal + amt;
    if (t.type === "EXPENSE" || t.type === "OWNER DRAWING") return bal - amt;
    return bal;
  }, 0);
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Mirror the active range one full period into the past.
 * Example: April 1–30 → March 1–31 (for period-over-period metrics).
 */
function priorPeriod(range: DateRange): DateRange {
  const duration = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - duration - 86_400_000),
    to:   new Date(range.from.getTime() - 1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Payroll:       "#ef4444",
  Software:      "#3b82f6",
  Marketing:     "#8b5cf6",
  Operations:    "#f59e0b",
  Travel:        "#10b981",
  Equipment:     "#6366f1",
  Subscriptions: "#ec4899",
  SaaS:          "#14b8a6",
  Other:         "#6b7280",
};

const DEFAULT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b",
  "#10b981", "#6366f1", "#ec4899", "#14b8a6",
];

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function buildInsights(
  metrics: FinancialMetrics,
  cashFlow: CashFlowDataPoint[],
  expenses: ExpenseCategoryData[],
  clients: IncomeClientData[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  // 1. Revenue trend
  if (metrics.revenueChange < -5) {
    insights.push({
      type: "warning",
      title: "Revenue Declining",
      description: `Income dropped ${Math.abs(metrics.revenueChange).toFixed(1)}% vs the prior period. Review your client pipeline for upcoming deals.`,
      metric: `${metrics.revenueChange.toFixed(1)}%`,
    });
  } else if (metrics.revenueChange > 10) {
    insights.push({
      type: "positive",
      title: "Revenue Growing",
      description: `Revenue is up ${metrics.revenueChange.toFixed(1)}% vs the prior period. Identify the driver and double down.`,
      metric: `+${metrics.revenueChange.toFixed(1)}%`,
    });
  }

  // 2. Negative or sharply declining cash flow
  const lastNet = cashFlow[cashFlow.length - 1]?.net ?? 0;
  const prevNet = cashFlow[cashFlow.length - 2]?.net ?? 0;
  if (lastNet < 0) {
    const runway = metrics.totalExpenses > 0
      ? Math.round((metrics.cashBalance / metrics.totalExpenses) * 30)
      : 0;
    insights.push({
      type: "warning",
      title: "Negative Cash Flow",
      description: `Cash flow is negative this period. At current burn rate you have ~${Math.max(0, runway)} days of runway.`,
    });
  } else if (prevNet > 0 && lastNet < prevNet * 0.75) {
    insights.push({
      type: "warning",
      title: "Cash Flow Declining",
      description: "Net cash flow dropped significantly from the previous month. Monitor closely to avoid a deficit.",
    });
  }

  // 3. Client concentration
  const totalIncome = clients.reduce((a, c) => a + c.amount, 0);
  if (clients.length > 0 && totalIncome > 0) {
    const top = clients[0];
    const pct = top.client !== "Unknown" ? (top.amount / totalIncome) * 100 : 0;
    if (pct > 60) {
      insights.push({
        type: "info",
        title: "High Client Concentration",
        description: `${top.client} generates ${pct.toFixed(0)}% of revenue. Diversify to reduce single-client risk.`,
        metric: `${pct.toFixed(0)}%`,
      });
    }
  }

  // 4. Software / subscription spend
  const softwareExp = expenses.find((e) =>
    ["Software", "Subscriptions", "SaaS"].includes(e.category)
  );
  if (softwareExp && softwareExp.percentage > 10) {
    insights.push({
      type: "warning",
      title: "High Software Spend",
      description: `${softwareExp.category} is ${softwareExp.percentage.toFixed(0)}% of expenses. Audit for unused tools — target below 10%.`,
      metric: `${softwareExp.percentage.toFixed(0)}%`,
    });
  }

  // 5. Payroll concentration
  const payroll = expenses.find((e) => e.category === "Payroll");
  if (payroll && payroll.percentage > 40) {
    insights.push({
      type: "warning",
      title: "Payroll Dominates Expenses",
      description: `Payroll is ${payroll.percentage.toFixed(0)}% of expenses — above the 40% healthy threshold. Review headcount efficiency.`,
      metric: `${payroll.percentage.toFixed(0)}%`,
    });
  }

  // 6. Profit margin
  if (metrics.profitMargin >= 25) {
    insights.push({
      type: "positive",
      title: "Strong Profit Margin",
      description: `${metrics.profitMargin.toFixed(1)}% margin is above the 20–25% average. Great position to reinvest in growth.`,
      metric: `${metrics.profitMargin.toFixed(1)}%`,
    });
  } else if (metrics.profitMargin < 10 && metrics.totalRevenue > 0) {
    insights.push({
      type: "warning",
      title: "Low Profit Margin",
      description: `At ${metrics.profitMargin.toFixed(1)}%, consider raising prices or cutting variable costs.`,
      metric: `${metrics.profitMargin.toFixed(1)}%`,
    });
  }

  // 7. Profitable period fallback (only if no positive insight yet)
  if (
    metrics.netProfit > 0 &&
    insights.filter((i) => i.type === "positive").length === 0
  ) {
    insights.push({
      type: "positive",
      title: "Profitable Period",
      description: `You closed this period with $${metrics.netProfit.toLocaleString()} net profit (${metrics.profitMargin.toFixed(1)}% margin). Keep it up.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      title: "Finances Look Stable",
      description: "No significant anomalies detected. Keep maintaining healthy revenue and controlled expenses.",
    });
  }

  return insights.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVE ALL DASHBOARD DATA
//
// Takes the full allTx array and the active date range.
// All slicing is done here in JS — no split between range rows and context rows.
// ─────────────────────────────────────────────────────────────────────────────

function deriveFinancialData(
  allTx: Transaction[],
  activeRange: DateRange,
): Omit<FinancialData, "loading" | "error" | "refetch"> {

  const fromStr = toLocalDateStr(activeRange.from);
  const toStr   = toLocalDateStr(activeRange.to);
  console.log("[useFinancialData] activeRange:", fromStr, "→", toStr,
    "| allTx:", allTx.length);

  // Period slice — all transactions that fall within the selected date range
  const periodTx = filterByRange(allTx, activeRange);
  console.log("[useFinancialData] periodTx after filter:", periodTx.length);

  // Prior period — same duration, shifted one period back
  const prior    = priorPeriod(activeRange);
  const priorTx  = filterByRange(allTx, prior);

  // ── KPI metrics ──────────────────────────────────────────────────────────
  const thisRevenue  = sumIncome(periodTx);
  const thisExpenses = sumExpenses(periodTx);
  const lastRevenue  = sumIncome(priorTx);
  const lastExpenses = sumExpenses(priorTx);
  const netProfit    = thisRevenue - thisExpenses;
  const profitMargin = thisRevenue > 0 ? (netProfit / thisRevenue) * 100 : 0;
  // Cash balance: all-time, all four types — uses the full allTx set
  const cashBalance  = runningCashBalance(allTx);

  const metrics: FinancialMetrics = {
    totalRevenue:   thisRevenue,
    totalExpenses:  thisExpenses,
    netProfit,
    profitMargin,
    cashBalance,
    revenueChange:  pctChange(thisRevenue,  lastRevenue),
    expenseChange:  pctChange(thisExpenses, lastExpenses),
    profitChange:   pctChange(netProfit, lastRevenue - lastExpenses),
  };

  // ── Trailing 6-month cash flow chart ─────────────────────────────────────
  // Always shows the last 6 calendar months regardless of selected date filter.
  // This gives the user a consistent trend line — switching to "Last 30 Days"
  // still shows the full 6-month history in the chart.
  const now = new Date();
  const cashFlow: CashFlowDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const label  = mStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const mRows  = filterByRange(allTx, { from: mStart, to: mEnd });
    cashFlow.push({
      month:    label,
      income:   sumIncome(mRows),
      expenses: sumExpenses(mRows),
      net:      sumIncome(mRows) - sumExpenses(mRows),
    });
  }

  // ── Expenses by category (period-filtered, EXPENSE only) ─────────────────
  const expMap: Record<string, number> = {};
  periodTx
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => { expMap[t.category] = (expMap[t.category] ?? 0) + t.amount; });
  const totalExpAmt = Object.values(expMap).reduce((a, v) => a + v, 0);
  const expensesByCategory: ExpenseCategoryData[] = Object.entries(expMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount], i) => ({
      category,
      amount,
      percentage: totalExpAmt > 0 ? (amount / totalExpAmt) * 100 : 0,
      color: CATEGORY_COLORS[category] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }));

  // ── Income by client / payee (period-filtered, INCOME only) ──────────────
  const clientMap: Record<string, { amount: number; count: number }> = {};
  periodTx
    .filter((t) => t.type === "INCOME")
    .forEach((t) => {
      const key = t.payee?.trim() || "Unknown";
      if (!clientMap[key]) clientMap[key] = { amount: 0, count: 0 };
      clientMap[key].amount += t.amount;
      clientMap[key].count  += 1;
    });
  const incomeByClient: IncomeClientData[] = Object.entries(clientMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([client, { amount, count }]) => ({ client, amount, transactions: count }))
    .slice(0, 8);

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights = buildInsights(metrics, cashFlow, expensesByCategory, incomeByClient);

  // NOTE: transactions bypasses the period filter and shows ALL rows so we can
  // confirm data reaches the component. Re-add filterByRange once confirmed.
  const tableRows = [...allTx].sort(
    (a, b) => b.transaction_date.localeCompare(a.transaction_date)
  );

  console.log(
    "[useFinancialData] → TransactionTable will receive:", tableRows.length, "rows",
    "\n  periodTx (filtered):", periodTx.length,
    "\n  sample dates:", tableRows.slice(0, 3).map(r => r.transaction_date),
  );

  return {
    metrics,
    cashFlow,
    expensesByCategory,
    incomeByClient,
    transactions: tableRows,
    insights,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA  (used when LIVE_MODE = false)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "t01", user_id: "mock", transaction_date: "2026-04-12", description: "Monthly Retainer — Daly City Chevrolet", amount: 1500, category: "Service",  type: "INCOME",        payee: "Daly City Chevrolet", is_deductible: null,  notes: null,                   created_at: "2026-04-12T10:00:00Z" },
  { id: "t02", user_id: "mock", transaction_date: "2026-04-10", description: "Campaign Management — Sigma Auto Group",  amount:  750, category: "Service",  type: "INCOME",        payee: "Sigma Auto Group",    is_deductible: null,  notes: null,                   created_at: "2026-04-10T09:00:00Z" },
  { id: "t03", user_id: "mock", transaction_date: "2026-04-08", description: "Ad Creative & Strategy",                  amount:  447, category: "Service",  type: "INCOME",        payee: "Daly City Chevrolet", is_deductible: null,  notes: null,                   created_at: "2026-04-08T11:00:00Z" },
  { id: "t04", user_id: "mock", transaction_date: "2026-04-06", description: "Performance Bonus — Q1",                  amount:  253, category: "Service",  type: "INCOME",        payee: "Sigma Auto Group",    is_deductible: null,  notes: null,                   created_at: "2026-04-06T14:00:00Z" },
  { id: "t05", user_id: "mock", transaction_date: "2026-04-01", description: "Team Payroll — April",                    amount: 1699, category: "Payroll",  type: "EXPENSE",       payee: null,                  is_deductible: true,  notes: "2 contractors + 1 FT", created_at: "2026-04-01T08:00:00Z" },
  { id: "t06", user_id: "mock", transaction_date: "2026-04-01", description: "Meta Ads Platform",                       amount:   99, category: "Software", type: "EXPENSE",       payee: "Meta",                is_deductible: true,  notes: null,                   created_at: "2026-04-01T08:05:00Z" },
  { id: "t07", user_id: "mock", transaction_date: "2026-04-01", description: "ClickUp Pro",                             amount:   45, category: "Software", type: "EXPENSE",       payee: "ClickUp",             is_deductible: true,  notes: null,                   created_at: "2026-04-01T08:10:00Z" },
  { id: "t08", user_id: "mock", transaction_date: "2026-04-01", description: "Figma Team",                              amount:   45, category: "Software", type: "EXPENSE",       payee: "Figma",               is_deductible: true,  notes: null,                   created_at: "2026-04-01T08:15:00Z" },
  { id: "t09", user_id: "mock", transaction_date: "2026-04-01", description: "Slack Pro",                               amount:   66, category: "Software", type: "EXPENSE",       payee: "Slack",               is_deductible: true,  notes: null,                   created_at: "2026-04-01T08:20:00Z" },
  { id: "t10", user_id: "mock", transaction_date: "2026-04-03", description: "Office Supplies & Misc",                  amount:  170, category: "Other",    type: "EXPENSE",       payee: null,                  is_deductible: false, notes: null,                   created_at: "2026-04-03T12:00:00Z" },
  { id: "t11", user_id: "mock", transaction_date: "2026-03-01", description: "Owner Capital Injection",                 amount: 5000, category: "Equity",   type: "EQUITY",        payee: null,                  is_deductible: false, notes: "Seed capital",         created_at: "2026-03-01T09:00:00Z" },
  { id: "t12", user_id: "mock", transaction_date: "2026-03-15", description: "Owner Draw — March",                      amount:  800, category: "Draw",     type: "OWNER DRAWING", payee: null,                  is_deductible: false, notes: null,                   created_at: "2026-03-15T10:00:00Z" },
  { id: "t13", user_id: "mock", transaction_date: "2026-03-10", description: "Monthly Retainer — Daly City Chevrolet", amount: 1500, category: "Service",  type: "INCOME",        payee: "Daly City Chevrolet", is_deductible: null,  notes: null,                   created_at: "2026-03-10T10:00:00Z" },
  { id: "t14", user_id: "mock", transaction_date: "2026-03-08", description: "Campaign Management — Sigma Auto Group",  amount:  500, category: "Service",  type: "INCOME",        payee: "Sigma Auto Group",    is_deductible: null,  notes: null,                   created_at: "2026-03-08T09:00:00Z" },
  { id: "t15", user_id: "mock", transaction_date: "2026-03-01", description: "Team Payroll — March",                    amount: 1699, category: "Payroll",  type: "EXPENSE",       payee: null,                  is_deductible: true,  notes: null,                   created_at: "2026-03-01T08:00:00Z" },
  { id: "t16", user_id: "mock", transaction_date: "2026-03-01", description: "Software Stack — March",                  amount:  255, category: "Software", type: "EXPENSE",       payee: null,                  is_deductible: true,  notes: "Bundled tools",        created_at: "2026-03-01T08:30:00Z" },
  { id: "t17", user_id: "mock", transaction_date: "2026-03-01", description: "Office Supplies & Misc",                  amount:  170, category: "Other",    type: "EXPENSE",       payee: null,                  is_deductible: false, notes: null,                   created_at: "2026-03-01T12:00:00Z" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
//
// SINGLE-QUERY ARCHITECTURE
//
// One SELECT * query fetches all transactions for the user (no date filter).
// All slicing — period metrics, prior-period comparison, 6-month cash flow,
// all-time cash balance — is done in JS inside deriveFinancialData.
//
// This avoids the earlier two-query split where Q1 (date-filtered) and Q2
// (all-time lightweight) could fall out of sync: if Q1 returned null/empty
// while Q2 succeeded, the transaction table, KPIs, and income-by-client chart
// would silently reset to empty while the cash flow chart kept updating.
//
// All React hooks are called unconditionally at the top of the function.
// LIVE_MODE and TABLE_HAS_USER_ID only affect what happens INSIDE the
// useCallback/useEffect bodies — never whether hooks are called.
// ─────────────────────────────────────────────────────────────────────────────

export function useFinancialData(dateRange?: DateRange): FinancialData {
  const { user } = useAuth();
  const activeRange = dateRange ?? last30DaysRange();

  // All transactions for this user — date filtering happens in JS
  const [allTx,  setAllTx]  = useState<Transaction[]>(LIVE_MODE ? [] : MOCK_TRANSACTIONS);
  const [loading, setLoading] = useState<boolean>(LIVE_MODE);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!LIVE_MODE) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("optimai_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (TABLE_HAS_USER_ID && user) query = query.eq("user_id", user.id);

      const { data, error: qErr } = await query;

      if (qErr) {
        throw new Error(`Query failed: ${qErr.message} (code: ${qErr.code})`);
      }

      // Normalize at ingestion so all downstream code sees clean types:
      //   transaction_date → strip any time component ("2026-04-16T00:00:00" → "2026-04-16")
      //   amount           → coerce to number (Supabase numeric(12,2) arrives as string)
      const rows: Transaction[] = ((data as Transaction[]) ?? []).map(t => ({
        ...t,
        transaction_date: t.transaction_date.slice(0, 10),
        amount: Number(t.amount),
      }));

      console.log(
        "[useFinancialData] raw rows from Supabase:", rows.length,
        "\n  first 3 dates :", rows.slice(0, 3).map(r => r.transaction_date),
        "\n  first amount  :", rows[0]?.amount, "(type:", typeof rows[0]?.amount + ")",
        "\n  first type    :", rows[0]?.type,
      );

      setAllTx(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load financial data.";
      setError(message);
      console.error("[useFinancialData]", message);
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + re-fetch whenever the user changes
  useEffect(() => {
    if (!LIVE_MODE) return;
    fetchData();
  }, [fetchData]);

  // Real-time subscription: re-fetch on any mutation for this user's rows.
  // Channel name is scoped to user.id so multiple hook instances don't collide.
  useEffect(() => {
    if (!LIVE_MODE || !user) return;

    const channelName = `finances-realtime-${user.id}`;
    const filter      = `user_id=eq.${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "optimai_transactions", filter },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const derived = deriveFinancialData(allTx, activeRange);

  return { ...derived, loading, error, refetch: fetchData };
}
