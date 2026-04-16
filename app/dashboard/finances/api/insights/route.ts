import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsightRow {
  amount: number;
  type: string;
  category: string;
  payee: string | null;
  transaction_date: string;
}

interface Insight {
  type: "positive" | "warning" | "info";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  metric?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(req: NextRequest): string | null {
  return req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
}

function authedClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

function sumByType(rows: InsightRow[], type: string): number {
  return rows.filter((r) => r.type === type).reduce((a, r) => a + r.amount, 0);
}

function monthWindow(rows: InsightRow[], monthsAgo: number): InsightRow[] {
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  return rows.filter((r) => {
    const d = new Date(r.transaction_date);
    return d >= from && d <= to;
  });
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = authedClient(token);

  // ── Fetch data ────────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from("optimai_transactions")
    .select("amount, type, category, payee, transaction_date")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows: InsightRow[] = data ?? [];

  // ── Derived metrics ───────────────────────────────────────────────────────────
  const thisMonth = monthWindow(rows, 0);
  const lastMonth = monthWindow(rows, 1);

  const thisIncome   = sumByType(thisMonth, "INCOME");
  const thisExpenses = sumByType(thisMonth, "EXPENSE");
  const lastIncome   = sumByType(lastMonth, "INCOME");
  const lastExpenses = sumByType(lastMonth, "EXPENSE");

  const netProfit    = thisIncome - thisExpenses;
  const profitMargin = thisIncome > 0 ? (netProfit / thisIncome) * 100 : 0;

  // Running cash balance (all-time): INCOME+EQUITY add, EXPENSE+OWNER DRAWING subtract
  const cashBalance = rows.reduce((bal, r) => {
    const amt = Number(r.amount);
    if (r.type === "INCOME"  || r.type === "EQUITY")        return bal + amt;
    if (r.type === "EXPENSE" || r.type === "OWNER DRAWING") return bal - amt;
    return bal;
  }, 0);

  // Monthly net trend (last 3 months)
  const nets = [2, 1, 0].map((i) => {
    const m = monthWindow(rows, i);
    return sumByType(m, "INCOME") - sumByType(m, "EXPENSE");
  });
  const cashTrendDeclining =
    nets.length === 3 && nets[1] < nets[0] && nets[2] < nets[1];

  // Expense breakdown (this month)
  const expMap: Record<string, number> = {};
  thisMonth
    .filter((r) => r.type === "EXPENSE")
    .forEach((r) => {
      expMap[r.category] = (expMap[r.category] || 0) + r.amount;
    });
  const totalExpAmt = Object.values(expMap).reduce((a, v) => a + v, 0);

  // Client income breakdown (this month)
  const clientMap: Record<string, number> = {};
  thisMonth
    .filter((r) => r.type === "INCOME")
    .forEach((r) => {
      const key = r.payee || "Unknown";
      clientMap[key] = (clientMap[key] || 0) + r.amount;
    });
  const topClient    = Object.entries(clientMap).sort((a, b) => b[1] - a[1])[0];
  const topClientPct = thisIncome > 0 && topClient
    ? (topClient[1] / thisIncome) * 100
    : 0;

  // Software/subscriptions pct
  const softwareAmt = (expMap["Software"] ?? 0) + (expMap["Subscriptions"] ?? 0);
  const softwarePct = totalExpAmt > 0 ? (softwareAmt / totalExpAmt) * 100 : 0;

  // Payroll pct
  const payrollPct  = totalExpAmt > 0
    ? ((expMap["Payroll"] ?? 0) / totalExpAmt) * 100
    : 0;

  // Runway in days
  const dailyBurn = thisExpenses / 30;
  const runway    = dailyBurn > 0 ? Math.round(cashBalance / dailyBurn) : Infinity;

  // ── Generate insights ─────────────────────────────────────────────────────────
  const insights: Insight[] = [];

  // 1. Income down
  if (lastIncome > 0 && thisIncome < lastIncome * 0.9) {
    const drop = ((lastIncome - thisIncome) / lastIncome) * 100;
    insights.push({
      type: "warning",
      severity: "high",
      title: "Income Declined",
      description: `Revenue is down ${drop.toFixed(1)}% vs last month ($${thisIncome.toLocaleString()} vs $${lastIncome.toLocaleString()}). Review your deal pipeline immediately.`,
      metric: `-${drop.toFixed(1)}%`,
    });
  }

  // 2. Cash low / runway alert
  if (cashBalance < thisExpenses) {
    insights.push({
      type: "warning",
      severity: "high",
      title: "Low Cash Balance",
      description: `Cash balance ($${cashBalance.toLocaleString()}) is below one month of expenses. Estimated runway: ${runway === Infinity ? "∞" : runway + " days"}. Prioritize collections.`,
      metric: `$${cashBalance.toLocaleString()}`,
    });
  }

  // 3. Software > 10%
  if (softwarePct > 10) {
    insights.push({
      type: "warning",
      severity: "medium",
      title: "High Software Spend",
      description: `Software & subscriptions account for ${softwarePct.toFixed(0)}% of expenses. Audit for unused tools — target below 10%.`,
      metric: `${softwarePct.toFixed(0)}%`,
    });
  }

  // 4. One client > 60% of revenue
  if (topClient && topClientPct > 60) {
    insights.push({
      type: "info",
      severity: "medium",
      title: "Client Concentration Risk",
      description: `${topClient[0]} generates ${topClientPct.toFixed(0)}% of your revenue. Diversify your client base to reduce dependency.`,
      metric: `${topClientPct.toFixed(0)}%`,
    });
  }

  // 5. Payroll > 40%
  if (payrollPct > 40) {
    insights.push({
      type: "warning",
      severity: "medium",
      title: "Payroll Concentration",
      description: `Payroll represents ${payrollPct.toFixed(0)}% of total expenses — above the healthy 40% threshold. Review headcount efficiency.`,
      metric: `${payrollPct.toFixed(0)}%`,
    });
  }

  // 6. Cash declining 3 months
  if (cashTrendDeclining) {
    insights.push({
      type: "warning",
      severity: "high",
      title: "Declining Cash Flow Trend",
      description: "Net cash flow has declined for 3 consecutive months. Investigate if this is seasonal or structural.",
    });
  }

  // 7. Profitable month
  if (netProfit > 0) {
    insights.push({
      type: "positive",
      severity: "low",
      title: "Profitable Month",
      description: `Net profit of $${netProfit.toLocaleString()} (${profitMargin.toFixed(1)}% margin). ${profitMargin >= 25 ? "Excellent margin — consider reinvesting in growth." : "Room to improve margin further."}`,
      metric: `+$${netProfit.toLocaleString()}`,
    });
  }

  // ── Stable fallback ───────────────────────────────────────────────────────────
  if (insights.length === 0) {
    insights.push({
      type: "info",
      severity: "low",
      title: "Finances Look Stable",
      description: "No significant anomalies detected this period. Keep maintaining healthy revenue and controlled expenses.",
    });
  }

  return NextResponse.json(
    { insights: insights.slice(0, 6) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
