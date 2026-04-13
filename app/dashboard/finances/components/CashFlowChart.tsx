"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CashFlowDataPoint } from "../hooks/useFinancialData";

interface CashFlowChartProps {
  data: CashFlowDataPoint[];
}

function formatAxis(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

function formatTooltip(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "oklch(0.12 0.005 260)",
    border: "1px solid oklch(0.22 0.005 260)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "oklch(0.95 0 0)", fontWeight: 600 },
  itemStyle: { color: "oklch(0.65 0 0)" },
  cursor: { stroke: "oklch(0.35 0.005 260)", strokeWidth: 1 },
};

export function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <h3 className="text-base font-semibold text-foreground mb-1">Cash Flow</h3>
      <p className="text-sm text-muted-foreground mb-5">
        Income vs. expenses — last 6 months
      </p>

      {data.every((d) => d.income === 0 && d.expenses === 0) ? (
        <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
          No cash flow data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cfIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cfExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cfNetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.22 0.005 260)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
              tickFormatter={formatAxis}
              dx={-8}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle}
              labelStyle={TOOLTIP_STYLE.labelStyle}
              itemStyle={TOOLTIP_STYLE.itemStyle}
              cursor={TOOLTIP_STYLE.cursor}
              formatter={(value: number, name: string) => [formatTooltip(value), name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: "12px",
                color: "oklch(0.65 0 0)",
                paddingTop: "16px",
              }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#cfIncomeGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#cfExpenseGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 3"
              fill="url(#cfNetGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
