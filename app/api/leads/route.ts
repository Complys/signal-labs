// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = (body?.name ?? "").toString().trim();
    const emailRaw = (body?.email ?? "").toString();

    const email = normalizeEmail(emailRaw);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    // Get current promo settings
    const [enabledSetting, codeSetting] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: "promo_enabled" } }),
      prisma.siteSetting.findUnique({ where: { key: "promo_code" } }),
    ]);

    const promoEnabled = (enabledSetting?.value ?? "true") === "true";
    if (!promoEnabled) {
      return NextResponse.json(
        { error: "This offer is currently unavailable." },
        { status: 400 }
      );
    }

    const promoCode = (codeSetting?.value ?? "WELCOME10").trim().toUpperCase();

    // Save lead (idempotent)
    const lead = await prisma.lead.upsert({
      where: { email },
      update: {
        name: name || undefined,
        source: "popup",
      },
      create: {
        email,
        name: name || null,
        source: "popup",
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // Optional: send thank-you email with the code
    // (Wire this up with Resend/SendGrid/Postmark and enable by env var.)
    //
    // Example (Resend):
    // if (process.env.RESEND_API_KEY) {
    //   const { Resend } = await import("resend");
    //   const resend = new Resend(process.env.RESEND_API_KEY);
    //   await resend.emails.send({
    //     from: process.env.PROMO_EMAIL_FROM || "Signal Labs <noreply@signallabs.co.uk>",
    //     to: lead.email,
    //     subject: "Your Signal Labs discount code",
    //     html: `
    //       <div style="font-family:Arial,sans-serif;line-height:1.5">
    //         <h2 style="margin:0 0 12px">Thanks${lead.name ? `, ${lead.name}` : ""}!</h2>
    //         <p style="margin:0 0 12px">Here’s your discount code for your first order:</p>
    //         <p style="font-size:24px;font-weight:700;letter-spacing:2px;margin:0 0 16px">
    //           ${promoCode}
    //         </p>
    //         <p style="margin:0 0 8px">Use it at checkout. If you have any questions, just reply to this email.</p>
    //         <p style="color:#666;font-size:12px;margin:16px 0 0">
    //           Research-use products only. Not for human or veterinary consumption.
    //         </p>
    //       </div>
    //     `,
    //   });
    // }

    return NextResponse.json({ code: promoCode, saved: true });
  } catch (err) {
    console.error("POST /api/leads error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
