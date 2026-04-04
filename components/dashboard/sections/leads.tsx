"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase, type Lead } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function LeadsSection() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [chartData, setChartData] = useState<
    Array<{ day: string; leads: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Get current month's leads
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;

        setLeads(data || []);

        // Generate chart data (leads per day)
        const daysInMonth = monthEnd.getDate();
        const leadsPerDay: Record<number, number> = {};

        // Initialize all days
        for (let i = 1; i <= daysInMonth; i++) {
          leadsPerDay[i] = 0;
        }

        // Count leads per day
        (data || []).forEach((lead) => {
          const leadDate = new Date(lead.created_at);
          const day = leadDate.getDate();
          leadsPerDay[day]++;
        });

        // Convert to chart format
        const chartData = Object.entries(leadsPerDay).map(([day, count]) => ({
          day: `${day}`,
          leads: count,
        }));

        setChartData(chartData);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("leads")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.lead_score === "hot").length;
  const warmLeads = leads.filter((l) => l.lead_score === "warm").length;
  const coldLeads = leads.filter((l) => l.lead_score === "cold").length;
  const avgScore =
    totalLeads > 0
      ? Math.round(leads.reduce((acc, l) => acc + l.lead_score_value, 0) / totalLeads)
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Leads Stats Cards */}
      <div className="space-y-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">This Month's Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="text-2xl font-semibold text-foreground">
                  {totalLeads}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                <p className="text-2xl font-semibold text-foreground">
                  {avgScore}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <span className="text-sm text-foreground">Hot</span>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  {hotLeads}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <span className="text-sm text-foreground">Warm</span>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {warmLeads}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <span className="text-sm text-foreground">Cold</span>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {coldLeads}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Bar Chart */}
      <div className="lg:col-span-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Leads per Day (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    stroke="var(--color-muted-foreground)"
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--color-foreground)" }}
                    cursor={{ fill: "rgba(255, 255, 255, 0.1)" }}
                  />
                  <Bar dataKey="leads" fill="rgb(59, 130, 246)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
