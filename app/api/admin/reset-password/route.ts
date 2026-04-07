export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return ok to prevent email enumeration
    if (!user) return NextResponse.json({ ok: true });

    // Generate a secure token valid for 1 hour
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), token, expires },
      update: { token, expires },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin-login/reset?token=${token}`;

    // Send email via SendGrid
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "info@signallaboratories.co.uk";

    if (SENDGRID_API_KEY) {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: email.toLowerCase() }] }],
          from: { email: FROM_EMAIL, name: "Signal Laboratories" },
          subject: "Reset your Signal Labs admin password",
          content: [{
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #111;">
                <h2 style="margin: 0 0 8px; font-size: 20px;">Reset your password</h2>
                <p style="color: #555; margin: 0 0 24px;">Click the button below to reset your Signal Labs admin password. This link expires in 1 hour.</p>
                <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 28px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Reset password →</a>
                <p style="margin: 24px 0 0; font-size: 12px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          }],
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
