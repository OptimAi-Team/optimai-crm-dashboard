import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

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
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !facebookAppId ||
      !facebookAppSecret ||
      !redirectUri ||
      !supabaseUrl ||
      !supabaseKey
    ) {
      console.error("Missing environment variables");
      return NextResponse.json(
        { error: "Missing server configuration" },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    // Note: Facebook OAuth token endpoint actually uses query parameters, not POST body
    const tokenParams = new URLSearchParams();
    tokenParams.append("client_id", facebookAppId);
    tokenParams.append("client_secret", facebookAppSecret);
    tokenParams.append("redirect_uri", `${redirectUri}/api/auth/facebook/callback`);
    tokenParams.append("code", code);

    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.search = tokenParams.toString();

    const tokenResp = await fetch(tokenUrl.toString());
    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || tokenData.error) {
      console.error("Failed to exchange code for token:", tokenData);
      return NextResponse.redirect(
        `${redirectUri}/settings?fb=error&message=${encodeURIComponent(
          tokenData.error?.message || "Failed to get access token"
        )}`
      );
    }

    const { access_token, token_type } = tokenData;

    if (!access_token) {
      console.error("No access token in response:", tokenData);
      return NextResponse.redirect(
        `${redirectUri}/settings?fb=error&message=No access token received`
      );
    }

    // Get Facebook user info to link with Supabase user
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${access_token}`
    );
    const userData = await userResponse.json();

    if (!userResponse.ok || userData.error) {
      console.error("Failed to get Facebook user info:", userData);
      return NextResponse.redirect(
        `${redirectUri}/settings?fb=error&message=Failed to get user info`
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user from Supabase auth
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.error("No authenticated user session");
      return NextResponse.redirect(
        `${redirectUri}/login?next=/settings&fb=error&message=Not authenticated`
      );
    }

    // Save Facebook connection to Supabase
    const { error: insertError } = await supabase
      .from("facebook_connections")
      .upsert(
        {
          user_id: session.user.id,
          facebook_user_id: userData.id,
          facebook_name: userData.name,
          facebook_email: userData.email,
          access_token: access_token,
          token_type: token_type,
          connected_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (insertError) {
      console.error("Failed to save Facebook connection:", insertError);
      return NextResponse.redirect(
        `${redirectUri}/settings?fb=error&message=Failed to save connection`
      );
    }

    // Redirect to settings page with success
    return NextResponse.redirect(`${redirectUri}/settings?fb=connected`);
  } catch (error) {
    console.error("Facebook OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/settings?fb=error&message=Internal server error`
    );
  }
}
