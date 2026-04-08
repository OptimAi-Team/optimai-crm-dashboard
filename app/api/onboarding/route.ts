import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(
      "https://webhook-production-64b6.up.railway.app/webhook/client-discovery",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error("Webhook failed");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
