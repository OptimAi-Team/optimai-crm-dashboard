import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  console.log("=== Facebook OAuth Initiation Started ===");
  try {
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("Environment check:", {
      facebookAppId: !!facebookAppId,
      redirectUri: !!redirectUri,
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
    });

    if (!facebookAppId || !redirectUri || !supabaseUrl || !supabaseKey) {
      console.error("Missing configuration");
      return NextResponse.json(
        { error: "Missing Facebook configuration" },
        { status: 500 }
      );
    }

    // Create Supabase client with request context to access cookies/auth
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
      },
    });

    // Get the session from the request cookies
    // This reads the Supabase session token from browser cookies
    const cookieStore = await cookies();
    const sessionData = cookieStore.get("sb-auth-token");
    console.log("Session cookie present:", !!sessionData);

    // Try to get the user from getSession() which reads from cookies
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("Session check result:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id || "none",
      sessionError: sessionError?.message || "none",
    });

    if (!session?.user) {
      console.error("No authenticated user found");
      console.log("Possible causes: session expired, user not logged in, or cookies not accessible");
      const loginUrl = `${redirectUri}/login?next=/settings&error=Facebook%20connection%20requires%20login`;
      console.log("Redirecting to login:", loginUrl);
      return NextResponse.redirect(loginUrl);
    }

    const userId = session.user.id;
    console.log("✓ Authenticated user for Facebook OAuth:", userId);

    // Create state parameter containing the user ID
    const state = encodeState(userId);
    console.log("✓ Generated state parameter for user:", userId);
    console.log("State parameter (base64):", state.substring(0, 20) + "...");

    // Required permissions for the OAuth flow
    const permissions = [
      "ads_read",
      "ads_management",
      "leads_retrieval",
      "catalog_management",
      "pages_messaging",
      "business_management",
    ];

    // Build the Facebook OAuth authorization URL
    const facebookAuthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    facebookAuthUrl.searchParams.append("client_id", facebookAppId);
    facebookAuthUrl.searchParams.append(
      "redirect_uri",
      `${redirectUri}/api/auth/facebook/callback`
    );
    facebookAuthUrl.searchParams.append("scope", permissions.join(","));
    facebookAuthUrl.searchParams.append("response_type", "code");
    facebookAuthUrl.searchParams.append("state", state);

    const fbUrl = facebookAuthUrl.toString();
    console.log("✓ Built Facebook OAuth URL");
    console.log("Callback URI:", `${redirectUri}/api/auth/facebook/callback`);
    console.log("Scope:", permissions.join(","));
    console.log("=== Redirecting to Facebook OAuth ===");
    return NextResponse.redirect(fbUrl);
  } catch (error) {
    console.error("=== Facebook OAuth Initiation Error ===");
    console.error("Error object:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to initiate Facebook OAuth" },
      { status: 500 }
    );
  }
}

function encodeState(userId: string): string {
  // Encode the user ID in base64 for the state parameter
  const stateData = JSON.stringify({ userId, nonce: Math.random().toString(36) });
  return Buffer.from(stateData).toString("base64");
}

export function decodeState(state: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return { userId: parsed.userId };
  } catch (error) {
    console.error("Failed to decode state parameter:", error);
    return null;
  }
}
