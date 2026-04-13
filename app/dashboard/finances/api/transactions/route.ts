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

  // ── Query params ─────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const limit    = Math.min(parseInt(searchParams.get("limit")  ?? "50", 10), 200);
  const offset   = Math.max(parseInt(searchParams.get("offset") ?? "0",  10), 0);
  const type     = searchParams.get("type")     ?? null;   // INCOME | EXPENSE
  const category = searchParams.get("category") ?? null;
  const dateFrom = searchParams.get("dateFrom") ?? null;   // ISO date string
  const dateTo   = searchParams.get("dateTo")   ?? null;

  // ── Count query ───────────────────────────────────────────────────────────────
  let countQuery = supabase
    .from("optimai_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (type)     countQuery = countQuery.eq("type", type.toUpperCase());
  if (category) countQuery = countQuery.eq("category", category);
  if (dateFrom) countQuery = countQuery.gte("transaction_date", dateFrom);
  if (dateTo)   countQuery = countQuery.lte("transaction_date", dateTo);

  const { count, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 });
  }

  // ── Data query ────────────────────────────────────────────────────────────────
  let dataQuery = supabase
    .from("optimai_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type)     dataQuery = dataQuery.eq("type", type.toUpperCase());
  if (category) dataQuery = dataQuery.eq("category", category);
  if (dateFrom) dataQuery = dataQuery.gte("transaction_date", dateFrom);
  if (dateTo)   dataQuery = dataQuery.lte("transaction_date", dateTo);

  const { data, error } = await dataQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const total   = count ?? 0;
  const page    = Math.floor(offset / limit) + 1;
  const hasMore = offset + limit < total;

  return NextResponse.json(
    {
      transactions: data ?? [],
      total,
      page,
      limit,
      hasMore,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
