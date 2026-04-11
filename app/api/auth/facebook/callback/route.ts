import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Import the decodeState function from the initiation route
function decodeState(state: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return { userId: parsed.userId };
  } catch (error) {
    console.error("Failed to decode state parameter:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  console.log("=== Facebook OAuth Callback Started ===");
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    console.log("Callback params:", { code: code ? "present" : "missing", error, errorDescription });

    // Handle errors from Facebook
    if (error) {
      console.error("Facebook OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/settings?fb=error&message=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code) {
      console.error("No authorization code received from Facebook");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/settings?fb=error&message=No authorization code received`
      );
    }

    // Get environment variables
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !facebookAppId ||
      !facebookAppSecret ||
      !redirectUri ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error("Missing environment variables");
      return NextResponse.json(
        { error: "Missing server configuration" },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams();
    tokenParams.append("client_id", facebookAppId);
    tokenParams.append("client_secret", facebookAppSecret);
    tokenParams.append("redirect_uri", `${redirectUri}/api/auth/facebook/callback`);
    tokenParams.append("code", code);

    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.search = tokenParams.toString();

    console.log("Exchanging code for access token...");
    const tokenResp = await fetch(tokenUrl.toString());
    const tokenData = await tokenResp.json();

    console.log("Token response status:", tokenResp.status);
    console.log("Token response (without access_token):", {
      ...tokenData,
      access_token: tokenData.access_token ? "***REDACTED***" : undefined,
    });

    if (!tokenResp.ok || tokenData.error) {
      console.error("Failed to exchange code for token:", {
        status: tokenResp.status,
        error: tokenData.error,
        errorDescription: tokenData.error_description,
      });
      return NextResponse.redirect(
        `${redirectUri}/?section=settings&fb=error&message=${encodeURIComponent(
          tokenData.error?.message || "Failed to get access token"
        )}`
      );
    }

    const { access_token, token_type } = tokenData;

    if (!access_token) {
      console.error("No access token in response:", tokenData);
      return NextResponse.redirect(
        `${redirectUri}/?section=settings&fb=error&message=No access token received`
      );
    }

    // Get Facebook user info to link with Supabase user
    console.log("Fetching Facebook user info...");
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${access_token}`
    );
    const userData = await userResponse.json();

    console.log("User info response status:", userResponse.status);
    console.log("User info:", { id: userData.id, name: userData.name, email: userData.email });

    if (!userResponse.ok || userData.error) {
      console.error("Failed to get Facebook user info:", userResponse.status, userData.error);
      return NextResponse.redirect(
        `${redirectUri}/?section=settings&fb=error&message=Failed to get user info`
      );
    }

    // Ensure we have name and email
    const fbName = userData.name || "Unknown";
    const fbEmail = userData.email || null;
    console.log("FB Name extracted:", fbName);
    console.log("FB Email extracted:", fbEmail || "not provided");

    // Fetch Facebook ad accounts and pages
    console.log("Fetching Facebook ad accounts for user:", userData.id);
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${access_token}`
    );
    const adAccountsData = await adAccountsResponse.json();
    const adAccountIds = adAccountsData.data?.map((acc: any) => acc.id) || [];
    console.log("Fetched ad accounts count:", adAccountIds.length);
    console.log("Ad account IDs:", adAccountIds);

    console.log("Fetching Facebook pages for user:", userData.id);
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name&access_token=${access_token}`
    );
    const pagesData = await pagesResponse.json();
    
    if (pagesResponse.ok && pagesData.data) {
      console.log("Pages response data:", pagesData);
    } else {
      console.warn("Pages fetch response:", { status: pagesResponse.status, error: pagesData.error });
    }
    
    const pageIds = pagesData.data?.map((page: any) => page.id) || [];
    console.log("Fetched pages count:", pageIds.length);
    console.log("Page IDs:", pageIds);

    // Calculate token expiration
    const tokenExpiresIn = tokenData.expires_in || 5184000; // Default 60 days if not provided
    const tokenExpiresAt = new Date(Date.now() + tokenExpiresIn * 1000).toISOString();
    console.log("Token expires at:", tokenExpiresAt);

    // Get state parameter containing the user ID
    const state = searchParams.get("state");
    console.log("Received state parameter:", state ? "present" : "missing");

    if (!state) {
      console.error("No state parameter received from Facebook");
      return NextResponse.redirect(
        `${redirectUri}/?section=settings&fb=error&message=No state parameter received`
      );
    }

    // Decode state to get the user ID
    const stateData = decodeState(state);
    if (!stateData || !stateData.userId) {
      console.error("Failed to decode state parameter or extract user ID");
      return NextResponse.redirect(
        `${redirectUri}/?section=settings&fb=error&message=Invalid state parameter`
      );
    }

    // authUserId is the Supabase auth.uid() — distinct from dealership slug (client_id)
    const authUserId = stateData.userId;
    console.log("✓ Extracted authUserId from state:", authUserId);

    // Service role client bypasses RLS — required because this is a server-side
    // OAuth redirect with no user session cookie available.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    console.log("Attempting to upsert facebook_connections for user_id:", authUserId);
    const upsertPayload = {
      user_id: authUserId,
      fb_user_id: userData.id,
      fb_name: fbName,
      fb_email: fbEmail,
      access_token: "***REDACTED***",
      expires_at: tokenExpiresAt,
      ad_account_ids: adAccountIds,
      page_ids: pageIds,
    };
    console.log("Upsert payload (access_token redacted):", upsertPayload);

    const { data: insertData, error: insertError } = await supabase
      .from("facebook_connections")
      .upsert(
        {
          user_id: authUserId,
          fb_user_id: userData.id,
          fb_name: fbName,
          fb_email: fbEmail,
          access_token: access_token,
          expires_at: tokenExpiresAt,
          ad_account_ids: adAccountIds,
          page_ids: pageIds,
        },
        {
          onConflict: "user_id",
        }
      )
      .select();

    console.log("Insert response - data:", insertData);
    console.log("Insert response - error:", insertError);

    if (insertError) {
      console.error("=== SUPABASE INSERT ERROR ===");
      console.error("Error code:", insertError.code);
      console.error("Error message:", insertError.message);
      console.error("Error hint:", insertError.hint);
      console.error("Error details:", insertError.details);
      console.error("Full error object:", JSON.stringify(insertError, null, 2));
      
      // Create a user-friendly error message (don't send full error to URL)
      const userMessage = insertError.code === "23505" 
        ? "Facebook account already connected for this user"
        : "Failed to save Facebook connection. Please try again.";
      
      const errorRedirect = `${redirectUri}/?section=settings&fb=error&message=${encodeURIComponent(userMessage)}`;
      console.error("Redirecting with error:", errorRedirect);
      return NextResponse.redirect(errorRedirect);
    }

    console.log("✓ Successfully saved Facebook connection for user_id:", authUserId);
    console.log("Saved data:", {
      user_id: authUserId,
      fb_user_id: userData.id,
      fb_name: fbName,
      fb_email: fbEmail,
      expires_at: tokenExpiresAt,
      ad_account_ids_count: adAccountIds.length,
      page_ids_count: pageIds.length,
    });
    const successUrl = `${redirectUri}/?section=settings&fb=connected`;
    console.log("=== Facebook OAuth Callback Completed Successfully ===");
    console.log("Redirecting to:", successUrl);
    // Redirect to dashboard settings section with success
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("=== Facebook OAuth Callback Error ===");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/settings?fb=error&message=Internal server error`
    );
  }
}
