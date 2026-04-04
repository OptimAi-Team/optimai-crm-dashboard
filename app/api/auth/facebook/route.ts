import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  console.log("=== Facebook OAuth Initiation Started ===");
  try {
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!facebookAppId || !redirectUri || !supabaseUrl || !supabaseKey) {
      console.error("Missing configuration:", { facebookAppId: !!facebookAppId, redirectUri: !!redirectUri, supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return NextResponse.json(
        { error: "Missing Facebook configuration" },
        { status: 500 }
      );
    }

    // Get the authenticated user
    const supabase = createClient(supabaseUrl, supabaseKey);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.error("No authenticated user found - user must be logged in to connect Facebook");
      return NextResponse.redirect(
        `${redirectUri}/login?next=/settings&error=Facebook connection requires login`
      );
    }

    const userId = session.user.id;
    console.log("Authenticated user for Facebook OAuth:", userId);

    // Create state parameter containing the user ID
    const state = encodeState(userId);
    console.log("Generated state parameter for user:", userId);

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

    console.log("Redirecting to Facebook OAuth with user ID in state");
    return NextResponse.redirect(facebookAuthUrl.toString());
  } catch (error) {
    console.error("=== Facebook OAuth Initiation Error ===");
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
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
