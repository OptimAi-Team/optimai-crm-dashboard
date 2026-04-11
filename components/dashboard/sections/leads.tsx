"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClientSideClient, type Lead } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const supabase = createClientSideClient();

// Returns the appropriate badge for a lead row.
// 'new' + under 24 h  → bright green NEW
// 'new' + over 24 h   → orange FOLLOW UP (decays automatically, no cron needed)
// hot / warm / cold   → standard score badge
function getLeadBadge(status: string | undefined, created_at: string) {
  if (status === "new") {
    const ageMs = Date.now() - new Date(created_at).getTime();
    const isUnder24h = ageMs < 24 * 60 * 60 * 1000;

    if (isUnder24h) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
          NEW
        </Badge>
      );
    }
    return (
      <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold">
        FOLLOW UP
      </Badge>
    );
  }

  const scoreStyles: Record<string, string> = {
    hot:  "bg-red-500/20 text-red-400 border-red-500/30",
    warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    cold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const normalised = (status ?? "warm").toLowerCase();
  const cls = scoreStyles[normalised] ?? "bg-secondary text-muted-foreground border-border";

  return (
    <Badge className={`border ${cls}`}>
      {(status ?? "warm").toUpperCase()}
    </Badge>
  );
}

export function LeadsSection() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [chartData, setChartData] = useState<Array<{ day: string; leads: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchLeads = async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("user_id", user.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString())
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Leads fetch error:", error);
          throw error;
        }

        setLeads(data || []);

        // Build leads-per-day chart data
        const daysInMonth = monthEnd.getDate();
        const leadsPerDay: Record<number, number> = {};
        for (let i = 1; i <= daysInMonth; i++) leadsPerDay[i] = 0;
        (data || []).forEach((lead) => {
          const day = new Date(lead.created_at).getDate();
          leadsPerDay[day]++;
        });
        setChartData(
          Object.entries(leadsPerDay).map(([day, count]) => ({ day, leads: count }))
        );
      } catch (err) {
        console.error("Error fetching leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();

    const channel = supabase
      .channel("leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchLeads)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user]);

  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.lead_score === "hot").length;
  const warmLeads = leads.filter((l) => l.lead_score === "warm").length;
  const coldLeads = leads.filter((l) => l.lead_score === "cold").length;
  const avgScore =
    totalLeads > 0
      ? Math.round(leads.reduce((acc, l) => acc + l.lead_score_value, 0) / totalLeads)
      : 0;

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Leads Stats Cards */}
      <div className="space-y-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">This Month&apos;s Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="text-2xl font-semibold text-foreground">{totalLeads}</p>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                <p className="text-2xl font-semibold text-foreground">{avgScore}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <span className="text-sm text-foreground">Hot</span>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{hotLeads}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <span className="text-sm text-foreground">Warm</span>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{warmLeads}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <span className="text-sm text-foreground">Cold</span>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{coldLeads}</Badge>
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

      {/* Leads Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All Leads This Month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : leads.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
              No leads this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Platform</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {lead.full_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lead.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {lead.platform || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {getLeadBadge(lead.status, lead.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
