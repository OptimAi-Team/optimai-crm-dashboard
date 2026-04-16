import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(req: NextRequest): string | null {
  return req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
}

function authedClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

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

  // ── Date range: current calendar month ──────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // ── Query ────────────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from("optimai_transactions")
    .select("amount, type, transaction_date")
    .eq("user_id", user.id)
    .gte("transaction_date", monthStart)
    .lte("transaction_date", monthEnd)
    .order("transaction_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = data ?? [];

  // ── Calculations ─────────────────────────────────────────────────────────────
  const total_income   = rows
    .filter((r) => r.type === "INCOME")
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const total_expenses = rows
    .filter((r) => r.type === "EXPENSE")
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const net_profit = total_income - total_expenses;

  // Running balance across ALL transactions (chronological) — fetch all-time
  const { data: allRows, error: allError } = await supabase
    .from("optimai_transactions")
    .select("amount, type, transaction_date")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: true });

  if (allError) {
    return NextResponse.json({ error: allError.message }, { status: 400 });
  }

  const cash_balance = (allRows ?? []).reduce((bal, r) => {
    const amt = Number(r.amount);
    if (r.type === "INCOME"  || r.type === "EQUITY")        return bal + amt;
    if (r.type === "EXPENSE" || r.type === "OWNER DRAWING") return bal - amt;
    return bal;
  }, 0);

  return NextResponse.json(
    {
      total_income:   Math.round(total_income   * 100) / 100,
      total_expenses: Math.round(total_expenses * 100) / 100,
      net_profit:     Math.round(net_profit     * 100) / 100,
      cash_balance:   Math.round(cash_balance   * 100) / 100,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
