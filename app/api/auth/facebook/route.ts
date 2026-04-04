import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_URL;

    if (!facebookAppId || !redirectUri) {
      return NextResponse.json(
        { error: "Missing Facebook configuration" },
        { status: 500 }
      );
    }

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
    facebookAuthUrl.searchParams.append("state", generateState());

    return NextResponse.redirect(facebookAuthUrl.toString());
  } catch (error) {
    console.error("Facebook OAuth error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Facebook OAuth" },
      { status: 500 }
    );
  }
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
