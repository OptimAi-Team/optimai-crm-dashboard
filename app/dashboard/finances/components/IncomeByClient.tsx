"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { IncomeClientData } from "../hooks/useFinancialData";

interface IncomeByClientProps {
  data: IncomeClientData[];
}

function formatAxis(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

const BAR_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
];

export function IncomeByClient({ data }: IncomeByClientProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <h3 className="text-base font-semibold text-foreground mb-1">
        Income by Client
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        Revenue breakdown by client this month
      </p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
          No income data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.22 0.005 260)"
              horizontal={false}
            />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
              tickFormatter={formatAxis}
              dx={-4}
            />
            <YAxis
              type="category"
              dataKey="client"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
              width={88}
              tickFormatter={(v: string) =>
                v.length > 11 ? `${v.slice(0, 11)}…` : v
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.12 0.005 260)",
                border: "1px solid oklch(0.22 0.005 260)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "oklch(0.95 0 0)", fontWeight: 600 }}
              itemStyle={{ color: "oklch(0.65 0 0)" }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            />
            <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={26}>
              {data.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
