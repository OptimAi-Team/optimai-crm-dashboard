import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("=== Facebook OAuth Initiation Started ===");
  try {
    // Get userId from query parameters (passed from client-side)
    const userId = request.nextUrl.searchParams.get("userId");
    console.log("Query params - userId:", userId ? "present" : "missing");

    if (!userId) {
      console.error("No userId provided in query parameters");
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    console.log("✓ Received userId from client:", userId);

    // Get environment configuration
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_URL;

    console.log("Environment check:", {
      facebookAppId: !!facebookAppId,
      redirectUri: !!redirectUri,
    });

    if (!facebookAppId || !redirectUri) {
      console.error("Missing Facebook configuration");
      return NextResponse.json(
        { error: "Missing Facebook configuration" },
        { status: 500 }
      );
    }

    // Encode userId in state parameter
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
