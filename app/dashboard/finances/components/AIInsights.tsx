"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, AlertTriangle, Info, Sparkles } from "lucide-react";
import type { AIInsight } from "../hooks/useFinancialData";

interface AIInsightsProps {
  insights: AIInsight[];
}

const INSIGHT_CONFIG = {
  positive: {
    Icon: TrendingUp,
    wrapper: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50",
    icon: "text-emerald-500",
    title: "text-emerald-400",
    metric: "text-emerald-400",
  },
  warning: {
    Icon: AlertTriangle,
    wrapper: "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50",
    icon: "text-amber-500",
    title: "text-amber-400",
    metric: "text-amber-400",
  },
  info: {
    Icon: Info,
    wrapper: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50",
    icon: "text-blue-400",
    title: "text-blue-400",
    metric: "text-blue-400",
  },
} as const;

export function AIInsights({ insights }: AIInsightsProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 h-full">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="text-base font-semibold text-foreground">AI Insights</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Automated analysis of your financial data
      </p>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const cfg = INSIGHT_CONFIG[insight.type];
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors duration-200",
                cfg.wrapper
              )}
            >
              <div className="mt-0.5 shrink-0">
                <cfg.Icon className={cn("w-4 h-4", cfg.icon)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-semibold leading-tight", cfg.title)}>
                    {insight.title}
                  </span>
                  {insight.metric && (
                    <span className={cn("text-sm font-bold shrink-0", cfg.metric)}>
                      {insight.metric}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
