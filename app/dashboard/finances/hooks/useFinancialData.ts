"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

export interface Transaction {
  id: string;
  user_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category: string;
  type: "INCOME" | "EXPENSE";
  client_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  cashBalance: number;
  revenueChange: number;
  expenseChange: number;
  profitChange: number;
}

export interface CashFlowDataPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ExpenseCategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface IncomeClientData {
  client: string;
  amount: number;
  transactions: number;
}

export interface AIInsight {
  type: "positive" | "warning" | "info";
  title: string;
  description: string;
  metric?: string;
}

export interface FinancialData {
  metrics: FinancialMetrics;
  cashFlow: CashFlowDataPoint[];
  expensesByCategory: ExpenseCategoryData[];
  incomeByClient: IncomeClientData[];
  transactions: Transaction[];
  insights: AIInsight[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─── Date range helpers (kept for page.tsx date filter UI) ───────────────────

export function thisMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function lastNMonthsRange(n: number): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - n + 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function ytdRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_METRICS: FinancialMetrics = {
  totalRevenue:  2950,
  totalExpenses: 2124,
  netProfit:      826,
  profitMargin:   27.9,
  cashBalance:   1304,
  revenueChange:  12.4,   // +12.4% vs prior month
  expenseChange:   3.1,   // +3.1% vs prior month
  profitChange:   38.2,   // +38.2% vs prior month
};

const MOCK_CASH_FLOW: CashFlowDataPoint[] = [
  { month: "Nov '25", income: 1800, expenses: 1600, net:  200 },
  { month: "Dec '25", income: 2200, expenses: 1900, net:  300 },
  { month: "Jan '26", income: 2400, expenses: 2000, net:  400 },
  { month: "Feb '26", income: 2100, expenses: 1950, net:  150 },
  { month: "Mar '26", income: 2700, expenses: 2050, net:  650 },
  { month: "Apr '26", income: 2950, expenses: 2124, net:  826 },
];

const MOCK_EXPENSES: ExpenseCategoryData[] = [
  { category: "Payroll",  amount: 1699, percentage: 80, color: "#ef4444" },
  { category: "Software", amount:  255, percentage: 12, color: "#3b82f6" },
  { category: "Other",    amount:  170, percentage:  8, color: "#6b7280" },
];

const MOCK_INCOME_BY_CLIENT: IncomeClientData[] = [
  { client: "Daly City Chevrolet", amount: 1947, transactions: 3 },
  { client: "Sigma Auto Group",    amount: 1003, transactions: 2 },
];

const MOCK_INSIGHTS: AIInsight[] = [
  {
    type: "positive",
    title: "Revenue Growing",
    description:
      "Revenue is up 12.4% vs last month. Daly City Chevrolet expanded their retainer — double down on that relationship.",
    metric: "+12.4%",
  },
  {
    type: "positive",
    title: "Strong Profit Margin",
    description:
      "27.9% margin is above the 20–25% industry average. You're in a healthy position to reinvest in growth.",
    metric: "27.9%",
  },
  {
    type: "warning",
    title: "High Client Concentration",
    description:
      "Daly City Chevrolet generates 66% of your revenue. Consider diversifying — losing this client would be critical.",
    metric: "66%",
  },
  {
    type: "warning",
    title: "Payroll Dominates Expenses",
    description:
      "Payroll is 80% of total expenses. While expected at this stage, monitor headcount efficiency as you scale.",
    metric: "80%",
  },
  {
    type: "info",
    title: "Cash Balance is Healthy",
    description:
      "Current cash balance of $1,304 covers ~18 days of expenses. Aim for 60–90 days to build a stronger buffer.",
    metric: "$1,304",
  },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    user_id: "mock-user",
    transaction_date: "2026-04-12",
    description: "Monthly Retainer — Daly City Chevrolet",
    amount: 1500,
    category: "Service",
    type: "INCOME",
    client_name: "Daly City Chevrolet",
    notes: null,
    created_at: "2026-04-12T10:00:00Z",
  },
  {
    id: "t2",
    user_id: "mock-user",
    transaction_date: "2026-04-10",
    description: "Campaign Management — Sigma Auto Group",
    amount: 750,
    category: "Service",
    type: "INCOME",
    client_name: "Sigma Auto Group",
    notes: null,
    created_at: "2026-04-10T09:00:00Z",
  },
  {
    id: "t3",
    user_id: "mock-user",
    transaction_date: "2026-04-08",
    description: "Ad Creative & Strategy — Daly City Chevrolet",
    amount: 447,
    category: "Service",
    type: "INCOME",
    client_name: "Daly City Chevrolet",
    notes: null,
    created_at: "2026-04-08T11:00:00Z",
  },
  {
    id: "t4",
    user_id: "mock-user",
    transaction_date: "2026-04-06",
    description: "Performance Bonus — Sigma Auto Group",
    amount: 253,
    category: "Service",
    type: "INCOME",
    client_name: "Sigma Auto Group",
    notes: null,
    created_at: "2026-04-06T14:00:00Z",
  },
  {
    id: "t5",
    user_id: "mock-user",
    transaction_date: "2026-04-01",
    description: "Team Payroll — April",
    amount: 1699,
    category: "Payroll",
    type: "EXPENSE",
    client_name: null,
    notes: "2 contractors + 1 FT",
    created_at: "2026-04-01T08:00:00Z",
  },
  {
    id: "t6",
    user_id: "mock-user",
    transaction_date: "2026-04-01",
    description: "Meta Ads Platform",
    amount: 99,
    category: "Software",
    type: "EXPENSE",
    client_name: null,
    notes: null,
    created_at: "2026-04-01T08:05:00Z",
  },
  {
    id: "t7",
    user_id: "mock-user",
    transaction_date: "2026-04-01",
    description: "ClickUp Pro",
    amount: 45,
    category: "Software",
    type: "EXPENSE",
    client_name: null,
    notes: null,
    created_at: "2026-04-01T08:10:00Z",
  },
  {
    id: "t8",
    user_id: "mock-user",
    transaction_date: "2026-04-01",
    description: "Figma Team",
    amount: 45,
    category: "Software",
    type: "EXPENSE",
    client_name: null,
    notes: null,
    created_at: "2026-04-01T08:15:00Z",
  },
  {
    id: "t9",
    user_id: "mock-user",
    transaction_date: "2026-04-01",
    description: "Slack Pro",
    amount: 66,
    category: "Software",
    type: "EXPENSE",
    client_name: null,
    notes: null,
    created_at: "2026-04-01T08:20:00Z",
  },
  {
    id: "t10",
    user_id: "mock-user",
    transaction_date: "2026-04-03",
    description: "Office Supplies & Misc",
    amount: 170,
    category: "Other",
    type: "EXPENSE",
    client_name: null,
    notes: null,
    created_at: "2026-04-03T12:00:00Z",
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Returns mock data immediately — no Supabase calls.
// Swap out the return statement below when the optimai_transactions table is ready.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useFinancialData(_dateRange?: DateRange): FinancialData {
  return {
    metrics:            MOCK_METRICS,
    cashFlow:           MOCK_CASH_FLOW,
    expensesByCategory: MOCK_EXPENSES,
    incomeByClient:     MOCK_INCOME_BY_CLIENT,
    transactions:       MOCK_TRANSACTIONS,
    insights:           MOCK_INSIGHTS,
    loading:            false,
    error:              null,
    refetch:            () => {},
  };
}
