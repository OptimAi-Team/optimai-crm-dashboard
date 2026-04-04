"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2,
  Search,
  Plus,
  MapPin,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  ExternalLink,
  Star,
  TrendingUp,
  TrendingDown,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, type Lead } from "@/lib/supabase";

const scoreColors: Record<string, string> = {
  hot: "bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400",
  warm: "bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-400",
  cold: "bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400",
  contacted: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  booked: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
};

// Helper functions for text transformations
const platformMap: Record<string, string> = {
  fb: "Facebook",
  ig: "Instagram",
  google: "Google",
};

const simplifyPlatform = (platform: string): string => {
  return platformMap[platform?.toLowerCase()] || platform || "Unknown";
};

const simplifyCreditscore = (score: string): string => {
  if (!score) return "N/A";
  
  // Remove the credit_score suffix
  let cleaned = score.replace(/_-_credit_score$/, "").replace(/_credit_score$/, "");
  
  // Handle "or_less" → "or less"
  if (cleaned.includes("or_less")) {
    return cleaned.replace(/_or_less/, " or less");
  }
  
  // Handle "or_more" → "+"
  if (cleaned.includes("or_more")) {
    const num = cleaned.match(/\d+/)?.[0] || "";
    return num ? `${num}+` : cleaned.replace(/_or_more/, "+");
  }
  
  // Handle ranges like "600_-_700" → "600-700"
  return cleaned.replace(/_-_/g, "-").replace(/_/g, "");
};

const simplifyTimeline = (timeline: string): string => {
  if (!timeline) return "N/A";
  
  const timelineMap: Record<string, string> = {
    "i_need_a_car_now": "Now",
    "i_need_a_car_now_!": "Now",
    "in_less_than_10_days": "< 10 days",
    "in_less_than_30_days": "< 30 days",
    "1_3_months": "1-3 months",
    "3_6_months": "3-6 months",
    "6_12_months": "6-12 months",
    "more_than_12_months": "12+ months",
  };
  
  // Try exact matches first
  for (const [key, value] of Object.entries(timelineMap)) {
    if (timeline === key || timeline.includes(key)) {
      return value;
    }
  }
  
  // Fallback: clean up underscores and basic formatting
  return timeline
    .replace(/_/g, " ")
    .replace(/!/g, "")
    .trim();
};

const simplifyDownPayment = (payment: string): string => {
  if (!payment) return "N/A";
  // Convert "$_3000_-_5000_down_payment" → "$3k-5k"
  return payment
    .replace(/\$_(\d+)_-_(\d+)_down_payment/g, (match, start, end) => {
      const s = parseInt(start) / 1000;
      const e = parseInt(end) / 1000;
      return `$${s}k-${e}k`;
    })
    .replace(/_down_payment$/, "")
    .replace(/_/g, " ");
};

const getRelativeTime = (createdAt: string): string => {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const daysAgo = Math.floor(
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 30) {
    const weeksAgo = Math.floor(daysAgo / 7);
    return `${weeksAgo} week${weeksAgo > 1 ? "s" : ""} ago`;
  }
  if (daysAgo < 365) {
    const monthsAgo = Math.floor(daysAgo / 30);
    return `${monthsAgo} month${monthsAgo > 1 ? "s" : ""} ago`;
  }
  const yearsAgo = Math.floor(daysAgo / 365);
  return `${yearsAgo} year${yearsAgo > 1 ? "s" : ""} ago`;
};

const getDateRangeFilter = (period: string): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7days":
      start.setDate(start.getDate() - 7);
      break;
    case "15days":
      start.setDate(start.getDate() - 15);
      break;
    case "30days":
      start.setDate(start.getDate() - 30);
      break;
    case "60days":
      start.setDate(start.getDate() - 60);
      break;
    case "90days":
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }
  
  return { start, end: now };
};

export function CustomersSection() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScore, setSelectedScore] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30days");
  const [, setUpdateTrigger] = useState(0); // Force re-render for relative time updates

  // Fetch and subscribe to real-time updates from Supabase
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        console.log("=== Fetching leads from Supabase ===");
        console.log("Supabase client state:", supabase);
        
        // Test the connection first
        const { data: testData, error: testError } = await supabase.auth.getSession();
        console.log("Auth session check - Error:", testError, "Data:", testData);

        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        console.log("Query response:", { data, error });

        if (error) {
          console.error("❌ Supabase error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: error.status,
            toString: error.toString(),
          });
          throw error;
        }

        console.log("✅ Successfully fetched", data?.length || 0, "leads");
        setLeads(data || []);
      } catch (error) {
        console.error("❌ Error fetching leads:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error cause:", error.cause);
        }
        // Don't show loading state on error - let UI handle it
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("leads")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((lead) =>
                lead.id === (payload.new as Lead).id
                  ? (payload.new as Lead)
                  : lead
              )
            );
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) =>
              prev.filter((lead) => lead.id !== (payload.old as Lead).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Update relative times every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger((prev) => prev + 1);
    }, 60000); // Update every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScore = !selectedScore || lead.lead_score === selectedScore;
    
    // Filter by date range
    const { start, end } = getDateRangeFilter(dateRange);
    const leadDate = new Date(lead.created_at);
    const matchesDate = leadDate >= start && leadDate <= end;
    
    return matchesSearch && matchesScore && matchesDate;
  });

  const avgScore = filteredLeads.length > 0
    ? Math.round(
        filteredLeads.reduce((acc, l) => acc + l.lead_score_value, 0) / filteredLeads.length
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Leads",
            value: filteredLeads.length.toString(),
            icon: Building2,
            color: "text-foreground",
          },
          {
            label: "Hot Leads",
            value: filteredLeads.filter((l) => l.lead_score === "hot").length.toString(),
            icon: TrendingUp,
            color: "text-red-500",
          },
          {
            label: "Avg Lead Score",
            value: `${avgScore}`,
            icon: Star,
            color: "text-chart-3",
          },
          {
            label: "Avg Health",
            value: `${avgScore}%`,
            icon: TrendingUp,
            color: "text-chart-1",
          },
        ].map((stat, index) => (
          <Card
            key={stat.label}
            className="border-border bg-card hover:border-muted-foreground/30 transition-all duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-[280px] bg-secondary border-border focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {["hot", "warm", "cold"].map((score) => (
              <Button
                key={score}
                variant={selectedScore === score ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScore(selectedScore === score ? null : score)}
                className={selectedScore === score ? `${score === 'hot' ? 'bg-red-500' : score === 'warm' ? 'bg-amber-500' : 'bg-blue-500'} text-white` : ""}
              >
                {score.charAt(0).toUpperCase() + score.slice(1)}
              </Button>
            ))}
          </div>
          {/* Date Range Dropdown */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px] bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="15days">Last 15 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="60days">Last 60 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Leads Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            Loading leads...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            No leads found
          </div>
        ) : (
          filteredLeads.map((lead, index) => {
            const initials = lead.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const timeLabel = getRelativeTime(lead.created_at);

            return (
              <Card
                key={lead.id}
                className="border-border bg-card hover:border-accent/50 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <CardContent className="p-5">
                  {/* Header with Avatar, Name, and Score Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 bg-secondary">
                        <AvatarFallback className="bg-secondary text-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                          {lead.full_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {simplifyPlatform(lead.platform)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge className={`${scoreColors[lead.lead_score]} border text-xs`}>
                        {lead.lead_score.toUpperCase()}
                      </Badge>
                      {lead.status && (
                        <Badge className={`${statusColors[lead.status?.toLowerCase()] || "bg-gray-500/20 text-gray-700 border-gray-500/30"} border text-xs`}>
                          {(lead.status?.charAt(0).toUpperCase() || "") + (lead.status?.slice(1).toLowerCase() || "")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact Info and Details */}
                  <div className="space-y-2 mb-4 text-sm">
                    {/* Phone */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{lead.phone || "N/A"}</span>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <a
                        href={`mailto:${lead.email}`}
                        className="hover:text-foreground truncate"
                      >
                        {lead.email}
                      </a>
                    </div>

                    {/* Credit Score */}
                    {lead.credit_score && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Credit Score:</span>
                        <span className="font-medium text-foreground">
                          {simplifyCreditscore(lead.credit_score)}
                        </span>
                      </div>
                    )}

                    {/* Timeline */}
                    {lead.timeline && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Timeline:</span>
                        <span className="font-medium text-foreground">
                          {simplifyTimeline(lead.timeline)}
                        </span>
                      </div>
                    )}

                    {/* Down Payment */}
                    {lead.down_payment && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Down Payment:</span>
                        <span className="font-medium text-foreground">
                          {simplifyDownPayment(lead.down_payment)}
                        </span>
                      </div>
                    )}

                    {/* Vehicle/Item ID */}
                    {(lead.retailer_item_id || true) && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Vehicle:</span>
                        <span className="font-medium text-foreground">
                          {lead.retailer_item_id && !lead.retailer_item_id.includes("{{")
                            ? lead.retailer_item_id
                            : "Pending"}
                        </span>
                      </div>
                    )}

                    {/* Created Date - Auto-updating relative time */}
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Created:</span>
                      <span className="font-medium text-foreground">
                        {timeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Lead Score Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">Lead Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${lead.lead_score_value}%`,
                            backgroundColor:
                              lead.lead_score === "hot"
                                ? "rgb(239, 68, 68)"
                                : lead.lead_score === "warm"
                                ? "rgb(245, 158, 11)"
                                : "rgb(59, 130, 246)",
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          lead.lead_score === "hot"
                            ? "text-red-500"
                            : lead.lead_score === "warm"
                            ? "text-amber-500"
                            : "text-blue-500"
                        }`}
                      >
                        {lead.lead_score_value}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                    >
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      Schedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                    >
                      <Mail className="w-3.5 h-3.5 mr-1.5" />
                      Email
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
