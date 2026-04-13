"use client";

import { useState, useEffect, useCallback } from "react";
import { createClientSideClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

export interface Transaction {
  id: string;
  user_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category: string;
  type: "INCOME" | "EXPENSE";
  client_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const supabase = createClientSideClient();

const CATEGORY_COLORS: Record<string, string> = {
  Software:   "#3b82f6",
  Marketing:  "#8b5cf6",
  Payroll:    "#ef4444",
  Operations: "#f59e0b",
  Travel:     "#10b981",
  Equipment:  "#6366f1",
  Other:      "#6b7280",
};

const DEFAULT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b",
  "#10b981", "#6366f1", "#ec4899", "#14b8a6",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumByType(txs: Transaction[], type: "INCOME" | "EXPENSE"): number {
  return txs
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + t.amount, 0);
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/** Shift a date range backwards by the same duration (prior period). */
function priorPeriod(range: DateRange): DateRange {
  const duration = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - duration - 86_400_000),
    to:   new Date(range.from.getTime() - 1),
  };
}

function buildInsights(
  metrics: FinancialMetrics,
  cashFlow: CashFlowDataPoint[],
  expenses: ExpenseCategoryData[],
  incomeByClient: IncomeClientData[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  // Revenue trend
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
      description: `Revenue is up ${metrics.revenueChange.toFixed(1)}% vs the prior period. Identify what's driving it and double down.`,
      metric: `+${metrics.revenueChange.toFixed(1)}%`,
    });
  }

  // Cash balance
  const lastNet = cashFlow[cashFlow.length - 1]?.net ?? 0;
  const prevNet = cashFlow[cashFlow.length - 2]?.net ?? 0;
  if (lastNet < 0) {
    const runway = metrics.totalExpenses > 0
      ? Math.floor((metrics.totalRevenue / metrics.totalExpenses) * 30)
      : 0;
    insights.push({
      type: "warning",
      title: "Negative Cash Flow",
      description: `Cash flow is negative this period. At current burn rate you have ~${runway} days of runway.`,
    });
  } else if (prevNet > 0 && lastNet < prevNet * 0.75) {
    insights.push({
      type: "warning",
      title: "Cash Flow Declining",
      description: "Net cash flow dropped significantly from the previous month. Monitor closely to avoid a deficit.",
    });
  }

  // Client concentration
  const totalIncome = incomeByClient.reduce((a, c) => a + c.amount, 0);
  if (incomeByClient.length > 0 && totalIncome > 0) {
    const top = incomeByClient[0];
    const pct = (top.amount / totalIncome) * 100;
    if (pct > 60) {
      insights.push({
        type: "info",
        title: "High Client Concentration",
        description: `${top.client} generates ${pct.toFixed(0)}% of your revenue. Diversify to reduce dependency risk.`,
        metric: `${pct.toFixed(0)}%`,
      });
    }
  }

  // Subscription / software spend
  const softwareExp = expenses.find((e) =>
    ["Software", "Subscriptions"].includes(e.category)
  );
  if (softwareExp && softwareExp.percentage > 10) {
    insights.push({
      type: "warning",
      title: "High Software/Subscription Spend",
      description: `Software accounts for ${softwareExp.percentage.toFixed(0)}% of expenses. Audit unused tools to cut overhead.`,
      metric: `${softwareExp.percentage.toFixed(0)}%`,
    });
  }

  // Payroll concentration
  const payrollExp = expenses.find((e) => e.category === "Payroll");
  if (payrollExp && payrollExp.percentage > 40) {
    insights.push({
      type: "warning",
      title: "Payroll Dominates Expenses",
      description: `Payroll is ${payrollExp.percentage.toFixed(0)}% of total expenses. Healthy max is ~40%. Consider headcount efficiency.`,
      metric: `${payrollExp.percentage.toFixed(0)}%`,
    });
  }

  // Profit margin
  if (metrics.profitMargin >= 30) {
    insights.push({
      type: "positive",
      title: "Strong Profit Margin",
      description: `${metrics.profitMargin.toFixed(1)}% margin — well above the 20–25% average. Great position to reinvest.`,
      metric: `${metrics.profitMargin.toFixed(1)}%`,
    });
  } else if (metrics.profitMargin < 10 && metrics.totalRevenue > 0) {
    insights.push({
      type: "warning",
      title: "Low Profit Margin",
      description: `At ${metrics.profitMargin.toFixed(1)}% margin, consider raising prices or cutting costs to protect the business.`,
      metric: `${metrics.profitMargin.toFixed(1)}%`,
    });
  }

  // Profitable month positive
  if (
    insights.filter((i) => i.type !== "positive").length > 0 &&
    metrics.netProfit > 0 &&
    insights.filter((i) => i.type === "positive").length === 0
  ) {
    insights.push({
      type: "positive",
      title: "Profitable Period",
      description: `Despite some areas to watch, you closed this period with a net profit. Keep it up.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      title: "Finances Look Stable",
      description: "No significant anomalies detected. Maintain healthy revenue and controlled expenses.",
    });
  }

  return insights.slice(0, 4);
}

// ─── Default range helpers ────────────────────────────────────────────────────

export function thisMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function lastNMonthsRange(n: number): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - n + 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function ytdRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFinancialData(dateRange?: DateRange): FinancialData {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolved active range
  const activeRange: DateRange = dateRange ?? thisMonthRange();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("optimai_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (fetchError) throw fetchError;
      setTransactions(data || []);
    } catch (err) {
      console.error("useFinancialData fetch error:", err);
      setError("Failed to load financial data.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("finances-transactions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "optimai_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Filter transactions to the active range
  const rangeTx = transactions.filter((t) => {
    const d = new Date(t.transaction_date);
    return d >= activeRange.from && d <= activeRange.to;
  });

  // Prior equivalent period for % change
  const prior = priorPeriod(activeRange);
  const priorTx = transactions.filter((t) => {
    const d = new Date(t.transaction_date);
    return d >= prior.from && d <= prior.to;
  });

  const thisRevenue  = sumByType(rangeTx, "INCOME");
  const thisExpenses = sumByType(rangeTx, "EXPENSE");
  const lastRevenue  = sumByType(priorTx, "INCOME");
  const lastExpenses = sumByType(priorTx, "EXPENSE");
  const netProfit    = thisRevenue - thisExpenses;
  const profitMargin = thisRevenue > 0 ? (netProfit / thisRevenue) * 100 : 0;

  // Running cash balance (all-time, chronological) — computed here so it's
  // available when building the metrics object below.
  const cashBalance = [...transactions]
    .sort(
      (a, b) =>
        new Date(a.transaction_date).getTime() -
        new Date(b.transaction_date).getTime()
    )
    .reduce(
      (bal, t) => bal + (t.type === "INCOME" ? t.amount : -t.amount),
      0
    );

  const metrics: FinancialMetrics = {
    totalRevenue:  thisRevenue,
    totalExpenses: thisExpenses,
    netProfit,
    profitMargin,
    cashBalance,
    revenueChange:  pctChange(thisRevenue,  lastRevenue),
    expenseChange:  pctChange(thisExpenses, lastExpenses),
    profitChange:   pctChange(netProfit, lastRevenue - lastExpenses),
  };

  // Cash flow — last 6 calendar months
  const now = new Date();
  const cashFlow: CashFlowDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label  = mStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d >= mStart && d <= mEnd;
    });
    const income   = sumByType(monthTx, "INCOME");
    const expenses = sumByType(monthTx, "EXPENSE");
    cashFlow.push({ month: label, income, expenses, net: income - expenses });
  }

  // Expenses by category (active range)
  const expenseMap: Record<string, number> = {};
  rangeTx
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    });
  const totalExpenseAmt = Object.values(expenseMap).reduce((a, v) => a + v, 0);
  const expensesByCategory: ExpenseCategoryData[] = Object.entries(expenseMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount], i) => ({
      category,
      amount,
      percentage: totalExpenseAmt > 0 ? (amount / totalExpenseAmt) * 100 : 0,
      color: CATEGORY_COLORS[category] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }));

  // Income by client (active range)
  const clientMap: Record<string, { amount: number; count: number }> = {};
  rangeTx
    .filter((t) => t.type === "INCOME")
    .forEach((t) => {
      const key = t.client_name || "Unknown";
      if (!clientMap[key]) clientMap[key] = { amount: 0, count: 0 };
      clientMap[key].amount += t.amount;
      clientMap[key].count++;
    });
  const incomeByClient: IncomeClientData[] = Object.entries(clientMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([client, { amount, count }]) => ({ client, amount, transactions: count }))
    .slice(0, 8);

  const insights = buildInsights(metrics, cashFlow, expensesByCategory, incomeByClient);

  return {
    metrics,
    cashFlow,
    expensesByCategory,
    incomeByClient,
    transactions: rangeTx,
    insights,
    loading,
    error,
    refetch: fetchData,
  };
}
