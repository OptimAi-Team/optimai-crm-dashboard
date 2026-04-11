"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClientSideClient, type Lead } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const supabase = createClientSideClient();

const scoreColors: Record<string, { bg: string; text: string }> = {
  hot: { bg: "bg-red-500/10", text: "text-red-500" },
  warm: { bg: "bg-amber-500/10", text: "text-amber-500" },
  cold: { bg: "bg-blue-500/10", text: "text-blue-500" },
};

const PLATFORM_MAP: Record<string, string> = {
  "Facebook": "fb",
  "Instagram": "ig",
  "Google": "google",
  "TikTok": "tiktok",
};

const simplifyDownPayment = (payment: string): string => {
  if (!payment) return "N/A";
  return payment
    .replace(/\$_(\d+)_-_(\d+)_down_payment/g, (match, start, end) => {
      const s = parseInt(start) / 1000;
      const e = parseInt(end) / 1000;
      return `$${s}k-${e}k`;
    })
    .replace(/_down_payment$/, "")
    .replace(/_/g, " ");
};

const getDownPaymentCategory = (payment: string): string => {
  if (!payment) return "";
  const match = payment.match(/\$_(\d+)_-_(\d+)/);
  if (match) {
    const start = parseInt(match[1]);
    if (start >= 7000) return "$7k+";
    if (start >= 5000) return "$5k-7k";
    if (start >= 3000) return "$3k-5k";
    return "$0-3k";
  }
  return "";
};

const getTimelineCategory = (timeline: string): string => {
  if (!timeline) return "";
  if (timeline.includes("i_need_a_car_now")) return "Now";
  if (timeline.includes("in_less_than_10_days")) return "Under 30 days";
  if (timeline.includes("1_3_months")) return "1-3 months";
  if (timeline.includes("3_6_months")) return "3-6 months";
  return "";
};

const getCreditScoreCategory = (score: string): string => {
  if (!score) return "";
  if (score.includes("599_or_less")) return "599 or less";
  if (score.includes("600_-_700")) return "600-700";
  if (score.includes("700_-_750")) return "700-750";
  if (score.includes("750_or_more")) return "750+";
  return "";
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

interface FilterState {
  platform: string[];
  downPayment: string[];
  creditScore: string[];
  timeline: string[];
  stage: string[];
}

export function DealsSection() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScore, setSelectedScore] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30days");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    platform: [],
    downPayment: [],
    creditScore: [],
    timeline: [],
    stage: [],
  });

  // Fetch leads from Supabase
  useEffect(() => {
    if (!user) return;
    const fetchLeads = async () => {
      try {
        console.log("=== Deals: Fetching leads from Supabase ===");
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        console.log("Deals: Query response:", { dataCount: data?.length || 0, hasError: !!error });
        
        if (error) {
          console.error("❌ Deals: Supabase error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: error.status,
          });
          throw error;
        }
        
        console.log("✅ Deals: Successfully fetched", data?.length || 0, "leads");
        setLeads(data || []);
      } catch (error) {
        console.error("❌ Deals: Error fetching leads:", error);
        if (error instanceof Error) {
          console.error("Deals: Error message:", error.message);
        }
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

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScore = !selectedScore || lead.lead_score === selectedScore;
    
    // Filter by date range
    const { start, end } = getDateRangeFilter(dateRange);
    const leadDate = new Date(lead.created_at);
    const matchesDate = leadDate >= start && leadDate <= end;
    
    // Filter by platform
    const matchesPlatform = filters.platform.length === 0 || filters.platform.includes(lead.platform);
    
    // Filter by down payment
    const dpCategory = getDownPaymentCategory(lead.down_payment);
    const matchesDownPayment = filters.downPayment.length === 0 || filters.downPayment.includes(dpCategory);
    
    // Filter by credit score
    const csCategory = getCreditScoreCategory(lead.credit_score);
    const matchesCreditScore = filters.creditScore.length === 0 || filters.creditScore.includes(csCategory);
    
    // Filter by timeline
    const tlCategory = getTimelineCategory(lead.timeline);
    const matchesTimeline = filters.timeline.length === 0 || filters.timeline.includes(tlCategory);
    
    // Filter by stage
    const matchesStage = filters.stage.length === 0 || filters.stage.includes(lead.status || "");
    
    return matchesSearch && matchesScore && matchesDate && matchesPlatform && matchesDownPayment && matchesCreditScore && matchesTimeline && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">View and manage all your leads in one place</p>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 h-9 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
            />
          </div>
          <div className="flex items-center gap-2">
            {["hot", "warm", "cold"].map((score) => (
              <button
                key={score}
                onClick={() => setSelectedScore(selectedScore === score ? null : score)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  selectedScore === score
                    ? `${score === 'hot' ? 'bg-red-500' : score === 'warm' ? 'bg-amber-500' : 'bg-blue-500'} text-white`
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {score.charAt(0).toUpperCase() + score.slice(1)}
              </button>
            ))}
          </div>
          {/* Date Range Dropdown */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] bg-secondary border-border h-9">
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
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <Filter className="w-4 h-4" />
          More filters
          <ChevronDown className={cn("w-3 h-3 transition-transform", showFilters && "rotate-180")} />
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Advanced Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Platform Filter */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Platform</h4>
              <div className="space-y-2">
                {Object.entries(PLATFORM_MAP).map(([displayName, dbValue]) => (
                  <label key={dbValue} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.platform.includes(dbValue)}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          platform: e.target.checked
                            ? [...prev.platform, dbValue]
                            : prev.platform.filter((p) => p !== dbValue),
                        }));
                      }}
                      className="w-4 h-4 rounded border-border bg-secondary text-accent cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">{displayName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Down Payment Filter */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Down Payment</h4>
              <div className="space-y-2">
                {["$0-3k", "$3k-5k", "$5k-7k", "$7k+"].map((amount) => (
                  <label key={amount} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.downPayment.includes(amount)}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          downPayment: e.target.checked
                            ? [...prev.downPayment, amount]
                            : prev.downPayment.filter((a) => a !== amount),
                        }));
                      }}
                      className="w-4 h-4 rounded border-border bg-secondary text-accent cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">{amount}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Credit Score Filter */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Credit Score</h4>
              <div className="space-y-2">
                {["599 or less", "600-700", "700-750", "750+"].map((score) => (
                  <label key={score} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.creditScore.includes(score)}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          creditScore: e.target.checked
                            ? [...prev.creditScore, score]
                            : prev.creditScore.filter((s) => s !== score),
                        }));
                      }}
                      className="w-4 h-4 rounded border-border bg-secondary text-accent cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">{score}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Timeline Filter */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Timeline</h4>
              <div className="space-y-2">
                {["Now", "Under 30 days", "1-3 months", "3-6 months"].map((time) => (
                  <label key={time} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.timeline.includes(time)}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          timeline: e.target.checked
                            ? [...prev.timeline, time]
                            : prev.timeline.filter((t) => t !== time),
                        }));
                      }}
                      className="w-4 h-4 rounded border-border bg-secondary text-accent cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">{time}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Stage Filter */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Stage</h4>
              <div className="space-y-2">
                {["New", "Contacted", "Qualified", "Appointment Set", "Sold", "Lost"].map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.stage.includes(s)}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          stage: e.target.checked
                            ? [...prev.stage, s]
                            : prev.stage.filter((st) => st !== s),
                        }));
                      }}
                      className="w-4 h-4 rounded border-border bg-secondary text-accent cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              onClick={() => {
                setFilters({
                  platform: [],
                  downPayment: [],
                  creditScore: [],
                  timeline: [],
                  stage: [],
                });
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
            <Button
              onClick={() => setShowFilters(false)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Company
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Value
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rep</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead, index) => {
                  const initials = lead.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const valueDisplay = simplifyDownPayment(lead.down_payment || "");
                  const createdDate = new Date(lead.created_at);
                  const dateStr = `${createdDate.getMonth() + 1}/${createdDate.getDate()}/${createdDate.getFullYear()}`;

                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors duration-150 cursor-pointer animate-in fade-in slide-in-from-left-2"
                      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 bg-secondary">
                            <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">{lead.full_name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {lead.email}
                        </a>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground">{lead.phone || "N/A"}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-semibold text-foreground">
                          {valueDisplay}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-1 rounded-md bg-secondary text-xs font-medium text-foreground">
                          {lead.status || "New"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border", scoreColors[lead.lead_score]?.bg ?? "bg-gray-500/10", scoreColors[lead.lead_score]?.text ?? "text-gray-500")}>
                          <span className="w-2 h-2 rounded-full bg-current"></span>
                          {lead.lead_score.toUpperCase()}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground">{lead.platform || "Direct"}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground">{dateStr}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
          <span className="text-sm text-muted-foreground">
            Showing {filteredLeads.length} of {leads.length} leads
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200">
              Previous
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm bg-accent text-accent-foreground font-medium">
              1
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200">
              2
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-200">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
