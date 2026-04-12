import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract only the fields the CRM backend expects
    const payload = {
      client_id: body.client_id,   // dealership slug, e.g. "acme-motors"
      name:      body.name,
      email:     body.email,
      phone:     body.phone,
      website:   body.website,
    };

    const response = await fetch(
      "https://primary-gaxt-production.up.railway.app/webhook-test/client-discovery",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Onboarding webhook error:", response.status, text);
      throw new Error("Webhook failed");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
