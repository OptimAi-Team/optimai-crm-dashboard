import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const n8nPayload = {
      user_id:        body.userId,
      name:           body.name,
      email:          body.email,
      dealershipName: body.dealershipName,
      phone:          body.phone,
      website:        body.website,
      location:       body.location,
      monthlyBudget:  body.monthlyBudget,
    };

    const response = await fetch(
      "https://webhook-production-64b6.up.railway.app/webhook/account-signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nPayload),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("account-signup webhook error:", response.status, text);
      throw new Error("Webhook failed");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("account-signup error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
