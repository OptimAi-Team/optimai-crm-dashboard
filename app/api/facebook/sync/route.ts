import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: NextRequest) {
  console.log("=== Facebook Sync Started ===");
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[sync] Missing required environment variables");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // ── Verify the caller's session ───────────────────────────────────────────
    const sessionUser = await verifyBearerToken(request, supabaseUrl, supabaseAnonKey);
    if (!sessionUser) {
      console.error("[sync] Unauthorized: missing or invalid Bearer token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Verify body userId matches session ────────────────────────────────────
    const body = await request.json();
    const { userId } = body as { userId?: string };

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId !== sessionUser.id) {
      console.error(`[sync] Forbidden: body userId ${userId} != session ${sessionUser.id}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[sync] Verified user: ${userId}`);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch the facebook_connections record for this user
    const { data: connection, error: fetchError } = await supabase
      .from("facebook_connections")
      .select("access_token, fb_user_id")
      .eq("user_id", userId)
      .single();

    if (fetchError || !connection) {
      console.error("[sync] Connection not found:", fetchError);
      return NextResponse.json({ error: "Facebook connection not found" }, { status: 404 });
    }

    const { access_token, fb_user_id } = connection as {
      access_token: string;
      fb_user_id: string;
    };

    if (!access_token) {
      return NextResponse.json({ error: "No valid Facebook access token found" }, { status: 400 });
    }

    // Fetch fresh ad accounts
    console.log(`[sync] Fetching ad accounts for fb_user_id: ${fb_user_id}`);
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${access_token}`
    );
    const adAccountsData = await adAccountsResponse.json();

    if (!adAccountsResponse.ok || adAccountsData.error) {
      console.error("[sync] Failed to fetch ad accounts:", adAccountsData.error);
      return NextResponse.json(
        { error: "Failed to fetch ad accounts from Facebook" },
        { status: 400 }
      );
    }

    const adAccountIds = adAccountsData.data?.map((acc: { id: string }) => acc.id) || [];
    console.log(`[sync] Ad accounts fetched: ${adAccountIds.length}`);

    // Fetch fresh pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name&access_token=${access_token}`
    );
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      console.warn("[sync] Pages fetch failed:", pagesData.error);
    }

    const pageIds = pagesData.data?.map((page: { id: string }) => page.id) || [];
    console.log(`[sync] Pages fetched: ${pageIds.length}`);

    // Update the connection record
    const { error: updateError } = await supabase
      .from("facebook_connections")
      .update({
        ad_account_ids: adAccountIds,
        page_ids: pageIds,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("[sync] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update Facebook connection" }, { status: 500 });
    }

    console.log(`=== Facebook Sync Complete for user: ${userId} ===`);

    return NextResponse.json({
      success: true,
      message: "Facebook data synced successfully",
      data: { ad_account_ids_count: adAccountIds.length, page_ids_count: pageIds.length },
    });
  } catch (error) {
    console.error("=== Facebook Sync Error ===", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
