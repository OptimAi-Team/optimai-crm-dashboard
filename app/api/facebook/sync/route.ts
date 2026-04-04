import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  console.log("=== Facebook Sync Started ===");
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      console.error("No userId provided for sync");
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log("Syncing Facebook data for user:", userId);

    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the facebook_connections record for this user
    console.log("Fetching facebook_connections record for user:", userId);
    const { data: connection, error: fetchError } = await supabase
      .from("facebook_connections")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError || !connection) {
      console.error("Error fetching FacebookConnection:", fetchError);
      return NextResponse.json(
        { error: "Facebook connection not found" },
        { status: 404 }
      );
    }

    console.log("Found facebook_connections record");
    const access_token = connection.access_token;
    const fb_user_id = connection.fb_user_id;

    if (!access_token) {
      console.error("No access token found for user:", userId);
      return NextResponse.json(
        { error: "No valid Facebook access token found" },
        { status: 400 }
      );
    }

    // Fetch fresh ad accounts from Facebook Graph API
    console.log("Fetching fresh ad accounts for user:", fb_user_id);
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${access_token}`
    );
    const adAccountsData = await adAccountsResponse.json();

    if (!adAccountsResponse.ok || adAccountsData.error) {
      console.error("Failed to fetch ad accounts:", adAccountsData.error);
      return NextResponse.json(
        { error: "Failed to fetch ad accounts from Facebook" },
        { status: 400 }
      );
    }

    const adAccountIds = adAccountsData.data?.map((acc: any) => acc.id) || [];
    console.log("Fetched ad accounts count:", adAccountIds.length);
    console.log("Ad account IDs:", adAccountIds);

    // Fetch fresh pages from Facebook Graph API
    console.log("Fetching fresh pages for user:", fb_user_id);
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name&access_token=${access_token}`
    );
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      console.warn("Pages fetch failed:", { status: pagesResponse.status, error: pagesData.error });
    } else if (pagesData.data) {
      console.log("Pages response data:", pagesData);
    }

    const pageIds = pagesData.data?.map((page: any) => page.id) || [];
    console.log("Fetched pages count:", pageIds.length);
    console.log("Page IDs:", pageIds);

    // Update the facebook_connections record with fresh data
    console.log("Updating facebook_connections record with fresh data");
    const { data: updatedData, error: updateError } = await supabase
      .from("facebook_connections")
      .update({
        ad_account_ids: adAccountIds,
        page_ids: pageIds,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select();

    if (updateError) {
      console.error("Error updating facebook_connections:", updateError);
      return NextResponse.json(
        { error: "Failed to update Facebook connection" },
        { status: 500 }
      );
    }

    console.log("✓ Successfully synced Facebook data for user:", userId);
    console.log("Updated data:", {
      ad_account_ids_count: adAccountIds.length,
      page_ids_count: pageIds.length,
    });

    return NextResponse.json({
      success: true,
      message: "Facebook data synced successfully",
      data: {
        ad_account_ids_count: adAccountIds.length,
        page_ids_count: pageIds.length,
      },
    });
  } catch (error) {
    console.error("Sync endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
