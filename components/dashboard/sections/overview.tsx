"use client";

import { useState, useEffect } from "react";
import { createClientSideClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { MetricCard } from "@/components/dashboard/metric-card";

const supabase = createClientSideClient();
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Users, Flame, Star, CalendarCheck } from "lucide-react";

interface OverviewData {
  totalLeads: number;
  hotLeads: number;
  avgLeadScore: number;
  leadsToday: number;
  leadsPerDay: Array<{ day: string; leads: number }>;
  scoreBreakdown: Array<{ name: string; value: number; color: string }>;
}

export function OverviewSection() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, lead_score, lead_score_value, created_at")
          .eq("user_id", user.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString());

        const leads = leadsData || [];

        // KPIs
        const totalLeads = leads.length;
        const hotLeads = leads.filter(
          (l) => l.lead_score === "hot"
        ).length;
        const leadsToday = leads.filter((l) => {
          const t = new Date(l.created_at).getTime();
          return t >= todayStart.getTime() && t < todayEnd.getTime();
        }).length;
        const avgLeadScore =
          totalLeads > 0
            ? Math.round(
                leads.reduce((acc, l) => acc + (l.lead_score_value || 0), 0) /
                  totalLeads
              )
            : 0;

        // Leads per day
        const daysInMonth = monthEnd.getDate();
        const leadsPerDayMap: Record<number, number> = {};
        for (let i = 1; i <= daysInMonth; i++) leadsPerDayMap[i] = 0;
        leads.forEach((lead) => {
          const day = new Date(lead.created_at).getDate();
          leadsPerDayMap[day]++;
        });
        const leadsPerDay = Object.entries(leadsPerDayMap).map(
          ([day, count]) => ({ day, leads: count })
        );

        // Score breakdown
        const hotCount = leads.filter((l) => l.lead_score === "hot").length;
        const warmCount = leads.filter((l) => l.lead_score === "warm").length;
        const coldCount = leads.filter((l) => l.lead_score === "cold").length;
        const scoreBreakdown = [
          { name: "hot", value: hotCount, color: "#ef4444" },
          { name: "warm", value: warmCount, color: "#f59e0b" },
          { name: "cold", value: coldCount, color: "#3b82f6" },
        ].filter((s) => s.value > 0);

        setData({
          totalLeads,
          hotLeads,
          avgLeadScore,
          leadsToday,
          leadsPerDay,
          scoreBreakdown,
        });
      } catch (err) {
        console.error("Overview fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Leads This Month"
          value={String(data.totalLeads)}
          change="this month"
          changeType="neutral"
          icon={Users}
          delay={0}
        />
        <MetricCard
          title="Hot Leads"
          value={String(data.hotLeads)}
          change="lead_score = hot"
          changeType="positive"
          icon={Flame}
          delay={1}
        />
        <MetricCard
          title="Avg Lead Score"
          value={String(data.avgLeadScore)}
          change="avg score value"
          changeType="neutral"
          icon={Star}
          delay={2}
        />
        <MetricCard
          title="New Leads Today"
          value={String(data.leadsToday)}
          change="today"
          changeType="neutral"
          icon={CalendarCheck}
          delay={3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads Per Day */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-base font-semibold text-foreground mb-1">
            Leads Per Day
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            This month&apos;s daily lead volume
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.leadsPerDay}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.22 0.005 260)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                allowDecimals={false}
                dx={-8}
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
              />
              <Bar
                dataKey="leads"
                fill="rgb(59,130,246)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hot/Warm/Cold Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <h3 className="text-base font-semibold text-foreground mb-1">
            Lead Score Breakdown
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Hot / Warm / Cold distribution
          </p>
          {data.scoreBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.scoreBreakdown}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.scoreBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
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
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px", color: "oklch(0.65 0 0)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
              No data
            </div>
          )}
          {/* Score counts */}
          <div className="space-y-2 mt-2">
            {data.scoreBreakdown.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ backgroundColor: `${s.color}15`, border: `1px solid ${s.color}30` }}
              >
                <span className="text-sm text-foreground">{s.name}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: s.color }}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
