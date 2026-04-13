"use client";

import { useFinancialData } from "@/app/dashboard/finances/hooks/useFinancialData";
import { MetricCard } from "@/app/dashboard/finances/components/MetricCard";
import { CashFlowChart } from "@/app/dashboard/finances/components/CashFlowChart";
import { ExpenseByCategory } from "@/app/dashboard/finances/components/ExpenseByCategory";
import { IncomeByClient } from "@/app/dashboard/finances/components/IncomeByClient";
import { AIInsights } from "@/app/dashboard/finances/components/AIInsights";
import { TransactionTable } from "@/app/dashboard/finances/components/TransactionTable";
import { DollarSign, TrendingDown, TrendingUp, Percent, Landmark } from "lucide-react";

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function FinancesSection() {
  const {
    metrics,
    cashFlow,
    expensesByCategory,
    incomeByClient,
    transactions,
    insights,
    loading,
    error,
  } = useFinancialData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          change={metrics.revenueChange}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="#10b981"
          delay={0}
          highlight
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(metrics.totalExpenses)}
          change={metrics.expenseChange}
          changeLabel="vs last month"
          icon={TrendingDown}
          iconColor="#ef4444"
          delay={1}
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(metrics.netProfit)}
          change={metrics.profitChange}
          changeLabel="vs last month"
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
          value={formatCurrency(metrics.cashBalance ?? 0)}
          change={0}
          icon={Landmark}
          iconColor="#a855f7"
          delay={4}
        />
      </div>

      {/* Cash Flow + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashFlowChart data={cashFlow} />
        </div>
        <ExpenseByCategory data={expensesByCategory} />
      </div>

      {/* Income by Client + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeByClient data={incomeByClient} />
        <AIInsights insights={insights} />
      </div>

      {/* Transaction Table */}
      <TransactionTable transactions={transactions} />
    </div>
  );
}
