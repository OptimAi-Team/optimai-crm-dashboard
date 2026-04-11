import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual, createHash } from "crypto";

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

const VALID_SCORES = new Set(["hot", "warm", "cold"]);

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

interface N8nLeadPayload {
  user_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  zip_code?: string;
  platform?: string;
  utm_campaign?: string;
  lead_score?: string;
  lead_score_value?: number;
  down_payment?: string;
  credit_score?: string;
  timeline?: string;
  retailer_item_id?: string;
  // status, updated_at, and notes are always overridden server-side — never trusted from payload
}

export async function POST(request: NextRequest) {
  // ── Secret check ──────────────────────────────────────────────────────────
  if (!WEBHOOK_SECRET) {
    console.error("[n8n-webhook] N8N_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const incoming = request.headers.get("x-webhook-secret");
  if (!incoming || !timingSafeStringEqual(incoming, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: N8nLeadPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id } = payload;
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // ── Normalise lead_score ──────────────────────────────────────────────────
  const rawScore =
    typeof payload.lead_score === "string"
      ? payload.lead_score.toLowerCase().trim()
      : null;
  const lead_score =
    rawScore && VALID_SCORES.has(rawScore) ? rawScore : "warm";

  // ── Supabase admin client ─────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[n8n-webhook] Missing Supabase environment variables");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Build row ─────────────────────────────────────────────────────────────
  const row: Record<string, unknown> = {
    user_id,
    full_name: payload.full_name ?? "Unknown",
    email: payload.email ?? "",
    phone: payload.phone ?? "",
    zip_code: payload.zip_code ?? "",
    platform: payload.platform ?? "n8n",
    utm_campaign: payload.utm_campaign ?? "",
    lead_score,
    lead_score_value: payload.lead_score_value ?? 50,
    status: "new",
    updated_at: new Date().toISOString(),
    notes: "Last submitted via n8n on " + new Date().toLocaleDateString(),
  };

  if (payload.down_payment !== undefined) row.down_payment = payload.down_payment;
  if (payload.credit_score !== undefined) row.credit_score = payload.credit_score;
  if (payload.timeline !== undefined) row.timeline = payload.timeline;
  if (payload.retailer_item_id !== undefined) row.retailer_item_id = payload.retailer_item_id;

  // ── Upsert with re-engagement logic ───────────────────────────────────────
  const { data, error: dbError } = await supabase
    .from("leads")
    .upsert(row, {
      onConflict: "phone,user_id",
      ignoreDuplicates: false,
    });

  if (dbError) {
    console.error("[n8n-webhook] Database error:", {
      message: dbError.message,
      code: dbError.code,
      hint: dbError.hint,
      details: dbError.details,
    });
    return NextResponse.json(
      {
        error: dbError.message,
        code: dbError.code,
        hint: dbError.hint,
        details: dbError.details,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 200 });
}
