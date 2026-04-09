"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { MetricCard } from "@/components/dashboard/metric-card";
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
import { Users, Flame, DollarSign, Car } from "lucide-react";

interface VehicleRow {
  vehicle_name: string;
  leads: number;
  spend: number;
  client_id: string;
}

interface OverviewData {
  totalLeads: number;
  hotLeads: number;
  costPerLead: number;
  bestVehicle: string;
  leadsPerDay: Array<{ day: string; leads: number }>;
  scoreBreakdown: Array<{ name: string; value: number; color: string }>;
  topVehicles: VehicleRow[];
}

const SCORE_COLORS: Record<string, string> = {
  Hot: "#ef4444",
  Warm: "#f59e0b",
  Cold: "#3b82f6",
};

export function OverviewSection() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Resolve client_id from the users table by the authenticated user's email
        let clientId: string | null = null;
        if (user?.email) {
          const { data: userRow } = await supabase
            .from("users")
            .select("client_id")
            .eq("email", user.email)
            .single();
          clientId = userRow?.client_id ?? null;
        }

        // Build campaign and vehicle queries — filter by client_id when available
        const campaignQuery = supabase
          .from("ad_campaigns")
          .select("spend, client_id");
        const vehicleQuery = supabase
          .from("vehicle_performance")
          .select("vehicle_name, leads, spend, client_id")
          .order("leads", { ascending: false });

        if (clientId) {
          campaignQuery.eq("client_id", clientId);
          vehicleQuery.eq("client_id", clientId);
        }

        // Fetch leads, ad_campaigns, and vehicle_performance in parallel
        const [leadsRes, campaignsRes, vehiclesRes] = await Promise.all([
          supabase
            .from("leads")
            .select("id, lead_score, created_at")
            .gte("created_at", monthStart.toISOString())
            .lte("created_at", monthEnd.toISOString()),
          campaignQuery,
          vehicleQuery,
        ]);

        const leads = leadsRes.data || [];
        const campaigns = campaignsRes.data || [];
        const vehicles = vehiclesRes.data || [];

        // KPIs
        const totalLeads = leads.length;
        const hotLeads = leads.filter(
          (l) => l.lead_score?.toLowerCase() === "hot"
        ).length;
        const totalSpend = campaigns.reduce(
          (acc: number, c: { spend: number }) => acc + (c.spend || 0),
          0
        );
        const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
        const bestVehicle = vehicles.length > 0 ? vehicles[0].vehicle_name : "—";

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
        const hotCount = leads.filter(
          (l) => l.lead_score?.toLowerCase() === "hot"
        ).length;
        const warmCount = leads.filter(
          (l) => l.lead_score?.toLowerCase() === "warm"
        ).length;
        const coldCount = leads.filter(
          (l) => l.lead_score?.toLowerCase() === "cold"
        ).length;
        const scoreBreakdown = [
          { name: "Hot", value: hotCount, color: "#ef4444" },
          { name: "Warm", value: warmCount, color: "#f59e0b" },
          { name: "Cold", value: coldCount, color: "#3b82f6" },
        ].filter((s) => s.value > 0);

        setData({
          totalLeads,
          hotLeads,
          costPerLead,
          bestVehicle,
          leadsPerDay,
          scoreBreakdown,
          topVehicles: vehicles.slice(0, 5),
        });
      } catch (err) {
        console.error("Overview fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          title="Cost Per Lead"
          value={
            data.costPerLead > 0
              ? `$${data.costPerLead.toFixed(2)}`
              : "—"
          }
          change="spend ÷ leads"
          changeType="neutral"
          icon={DollarSign}
          delay={2}
        />
        <MetricCard
          title="Best Performing Vehicle"
          value={data.bestVehicle}
          change="by lead count"
          changeType="positive"
          icon={Car}
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

      {/* Top 5 Vehicles Table */}
      <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <h3 className="text-base font-semibold text-foreground mb-1">
          Top Vehicles by Leads
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          Top 5 from vehicle_performance
        </p>
        {data.topVehicles.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                  Vehicle
                </th>
                <th className="text-right py-2 pr-4 text-muted-foreground font-medium">
                  Leads
                </th>
                <th className="text-right py-2 text-muted-foreground font-medium">
                  Spend
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topVehicles.map((v, i) => (
                <tr
                  key={`${v.vehicle_name}-${i}`}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-3 pr-4 text-foreground font-medium">
                    {v.vehicle_name}
                  </td>
                  <td className="py-3 pr-4 text-right text-foreground">
                    {v.leads}
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {v.spend != null ? `$${Number(v.spend).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground text-sm">No vehicle data found.</p>
        )}
      </div>
    </div>
  );
}
