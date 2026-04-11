import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface FbFieldData {
  name: string;
  values: string[];
}

interface FbLead {
  id: string;
  created_time: string;
  field_data: FbFieldData[];
}

interface FbLeadsPage {
  data: FbLead[];
  paging?: { cursors?: { after?: string }; next?: string };
}

interface FbForm {
  id: string;
  name: string;
}

interface FbFormsPage {
  data: FbForm[];
  paging?: { cursors?: { after?: string }; next?: string };
}

// ── Auth helper ───────────────────────────────────────────────────────────────
// Validates the Bearer JWT from the Authorization header against Supabase.
// Returns the verified user, or null if the token is missing/invalid.
async function verifyBearerToken(
  request: NextRequest,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return null;

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await anonClient.auth.getUser(jwt);
  if (error || !user) return null;
  return user;
}

// ── Pagination helper ─────────────────────────────────────────────────────────
async function fetchAllPages<
  T extends { data: unknown[]; paging?: { next?: string } }
>(url: string, label: string): Promise<T["data"]> {
  const results: unknown[] = [];
  let nextUrl: string | null = url;
  let page = 0;

  while (nextUrl) {
    page++;
    console.log(`[fb-graph] ${label} — page ${page}`);
    const resp = await fetch(nextUrl);
    const json = (await resp.json()) as T;

    if (!resp.ok || (json as { error?: { message: string } }).error) {
      const err = (json as { error?: { message: string; code?: number } }).error;
      console.error(`[fb-graph] ${label} — HTTP ${resp.status}`, err);
      throw new Error(err?.message ?? `Graph API error ${resp.status} for ${label}`);
    }

    results.push(...json.data);
    nextUrl = json.paging?.next ?? null;
  }

  console.log(`[fb-graph] ${label} — total: ${results.length}`);
  return results as T["data"];
}

// ── Field mapper ─────────────────────────────────────────────────────────────
function mapFbLeadToRow(
  fbLead: FbLead,
  formName: string,
  userId: string
): Record<string, unknown> {
  const raw: Record<string, string> = {};
  for (const field of fbLead.field_data) {
    raw[field.name] = field.values[0] ?? "";
  }

  // No PII logged — raw contains email/phone
  let full_name = raw["full_name"] ?? "";
  if (!full_name && (raw["first_name"] || raw["last_name"])) {
    full_name = [raw["first_name"], raw["last_name"]].filter(Boolean).join(" ");
  }

  return {
    user_id: userId,
    full_name: full_name || "Unknown",
    email: raw["email"] ?? "",
    phone: raw["phone_number"] ?? "",
    zip_code: raw["zip_code"] ?? "",
    platform: "facebook",
    utm_campaign: formName,
    lead_score: "warm",
    lead_score_value: 50,
    retailer_item_id: fbLead.id,
    created_at: fbLead.created_time,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  console.log("=== Facebook Lead Sync Started ===");

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[sync-leads] Missing required environment variables");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // ── Step 1: Verify the caller's session ───────────────────────────────────
    const sessionUser = await verifyBearerToken(request, supabaseUrl, supabaseAnonKey);
    if (!sessionUser) {
      console.error("[sync-leads] Unauthorized: missing or invalid Bearer token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Step 2: Verify body userId matches the session ────────────────────────
    const body = await request.json();
    const { userId } = body as { userId?: string };

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId !== sessionUser.id) {
      console.error(`[sync-leads] Forbidden: body userId ${userId} != session ${sessionUser.id}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[sync-leads] Verified user: ${userId}`);

    // Service role client — bypasses RLS; safe because identity is verified above
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── Step 3: Load Facebook connection ──────────────────────────────────────
    const { data: connection, error: connError } = await supabase
      .from("facebook_connections")
      .select("access_token, page_ids, expires_at")
      .eq("user_id", userId)
      .single();

    if (connError || !connection) {
      console.error("[sync-leads] facebook_connections lookup failed:", connError);
      return NextResponse.json(
        { error: "Facebook connection not found. Please reconnect." },
        { status: 404 }
      );
    }

    const { access_token, page_ids, expires_at } = connection as {
      access_token: string;
      page_ids: string[];
      expires_at: string | null;
    };

    if (!access_token) {
      return NextResponse.json({ error: "No Facebook access token found." }, { status: 400 });
    }

    if (expires_at && new Date(expires_at) < new Date()) {
      console.warn(`[sync-leads] Token expired at ${expires_at}`);
    }

    const pages: string[] = Array.isArray(page_ids) ? page_ids : [];
    console.log(`[sync-leads] Pages to process: ${pages.length}`);

    if (pages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Facebook pages connected. Reconnect Facebook to grant page access.",
        synced: 0,
        skipped: 0,
      });
    }

    // ── Step 4: Load existing IDs for deduplication (scoped to this user) ─────
    const { data: existingRows, error: existingErr } = await supabase
      .from("leads")
      .select("retailer_item_id")
      .eq("user_id", userId)
      .not("retailer_item_id", "is", null);

    if (existingErr) {
      console.error("[sync-leads] Failed to fetch existing leads:", existingErr);
      return NextResponse.json(
        { error: "Failed to load existing leads for dedup check." },
        { status: 500 }
      );
    }

    const existingIds = new Set(
      (existingRows ?? [])
        .map((r: { retailer_item_id: string | null }) => r.retailer_item_id)
        .filter(Boolean)
    );
    console.log(`[sync-leads] ${existingIds.size} existing lead IDs for user`);

    // ── Step 5: Walk pages → forms → leads ────────────────────────────────────
    const toInsert: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const pageId of pages) {
      console.log(`[sync-leads] Processing page: ${pageId}`);

      let forms: FbForm[];
      try {
        forms = (await fetchAllPages<FbFormsPage>(
          `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?fields=id,name&access_token=${access_token}`,
          `page ${pageId} forms`
        )) as FbForm[];
      } catch (err) {
        console.error(
          `[sync-leads] ⚠ Failed to fetch forms for page ${pageId}. ` +
            `Check 'ads_management' or 'leads_retrieval' permission.`,
          err
        );
        continue;
      }

      console.log(`[sync-leads] Page ${pageId}: ${forms.length} form(s)`);

      for (const form of forms) {
        let fbLeads: FbLead[];
        try {
          fbLeads = (await fetchAllPages<FbLeadsPage>(
            `https://graph.facebook.com/v18.0/${form.id}/leads?fields=id,created_time,field_data&access_token=${access_token}`,
            `form ${form.id} leads`
          )) as FbLead[];
        } catch (err) {
          console.error(
            `[sync-leads] ⚠ Failed to fetch leads for form ${form.id} ("${form.name}"). ` +
              `Check 'leads_retrieval' permission.`,
            err
          );
          continue;
        }

        console.log(`[sync-leads] Form "${form.name}": ${fbLeads.length} lead(s)`);

        for (const fbLead of fbLeads) {
          if (existingIds.has(fbLead.id)) {
            skipped++;
            continue;
          }
          toInsert.push(mapFbLeadToRow(fbLead, form.name, userId));
          existingIds.add(fbLead.id);
        }
      }
    }

    console.log(`[sync-leads] To insert: ${toInsert.length}, skipped: ${skipped}`);

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Sync complete. No new leads found (${skipped} already existed).`,
        synced: 0,
        skipped,
      });
    }

    // ── Step 6: Batch insert ──────────────────────────────────────────────────
    const CHUNK_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase.from("leads").insert(chunk);

      if (insertError) {
        console.error(`[sync-leads] Insert error:`, {
          message: insertError.message,
          code: insertError.code,
          hint: insertError.hint,
        });
        return NextResponse.json(
          { error: `Database insert failed: ${insertError.message}`, synced: insertedCount, skipped },
          { status: 500 }
        );
      }

      insertedCount += chunk.length;
    }

    console.log(`=== Lead Sync Complete: ${insertedCount} inserted, ${skipped} skipped ===`);

    return NextResponse.json({
      success: true,
      message: `Synced ${insertedCount} new lead${insertedCount !== 1 ? "s" : ""} (${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped).`,
      synced: insertedCount,
      skipped,
    });
  } catch (error) {
    console.error("=== Lead Sync Unhandled Error ===", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
