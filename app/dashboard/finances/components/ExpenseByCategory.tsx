"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ExpenseCategoryData } from "../hooks/useFinancialData";

interface ExpenseByCategoryProps {
  data: ExpenseCategoryData[];
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function ExpenseByCategory({ data }: ExpenseByCategoryProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 h-full">
      <h3 className="text-base font-semibold text-foreground mb-1">
        Expenses by Category
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Spending breakdown for selected period
      </p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          No expense data
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={3}
                dataKey="amount"
                nameKey="category"
              >
                {data.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.12 0.005 260)",
                  border: "1px solid oklch(0.22 0.005 260)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "oklch(0.65 0 0)" }}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2 mt-3">
            {data.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors duration-150"
                style={{
                  backgroundColor: `${item.color}15`,
                  border: `1px solid ${item.color}30`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-foreground">{item.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {item.percentage.toFixed(0)}%
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: item.color }}
                  >
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
