"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FinanceMetricCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  delay?: number;
  highlight?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  delay = 0,
  highlight = false,
}: FinanceMetricCardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  return (
    <div
      className={cn(
        "group relative rounded-xl p-5 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-4",
        highlight
          ? "bg-accent/10 border border-accent/30 hover:border-accent/60"
          : "bg-card border border-border hover:border-accent/50"
      )}
      style={{ animationDelay: `${delay * 100}ms`, animationFillMode: "both" }}
    >
      {/* Hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm text-muted-foreground font-medium">{title}</span>
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-300",
              highlight
                ? "bg-accent/20 group-hover:bg-accent/30"
                : "bg-secondary group-hover:bg-accent/10"
            )}
          >
            <Icon
              className="w-4 h-4 transition-colors duration-300"
              style={{ color: iconColor || "oklch(0.65 0 0)" }}
            />
          </div>
        </div>

        <div className="flex items-end gap-3">
          <span className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            {value}
          </span>
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium mb-1",
              isPositive && "text-success",
              isNegative && "text-destructive",
              isNeutral && "text-muted-foreground"
            )}
          >
            {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
            {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
            {isNeutral && <Minus className="w-3.5 h-3.5" />}
            <span>
              {isNeutral
                ? "No change"
                : `${isPositive ? "+" : ""}${change.toFixed(1)}%`}
              {changeLabel ? ` ${changeLabel}` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
