import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderRef, customerName, customerEmail, items } = body;

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "No SendGrid key" });

    sgMail.setApiKey(apiKey);

    const itemsList = (items ?? [])
      .map((i: any) => `<li>${i.name} x${i.quantity}</li>`)
      .join("");

    await sgMail.send({
      to: process.env.SUPPORT_TO_EMAIL || "support@signallaboratories.co.uk",
      from: process.env.ORDERS_FROM_EMAIL || "Signal Laboratories <info@signallaboratories.co.uk>",
      subject: `Back Order Placed — ${orderRef}`,
      html: `
        <h2>Back Order Notification</h2>
        <p>A new order containing back order items has been placed.</p>
        <p><strong>Order ref:</strong> ${orderRef}</p>
        <p><strong>Customer:</strong> ${customerName || "Unknown"} (${customerEmail || "No email"})</p>
        <h3>Back order items:</h3>
        <ul>${itemsList}</ul>
        <p>Please ensure these items are dispatched as soon as stock arrives.</p>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://signallaboratories.co.uk"}/admin/orders">View in admin</a></p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Back order notification error:", e);
    return NextResponse.json({ ok: false, error: e?.message });
  }
}
