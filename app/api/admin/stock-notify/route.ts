export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, stock: true },
  });

  if (!product || product.stock <= 0) {
    return NextResponse.json({ error: "Product not found or still out of stock" }, { status: 400 });
  }

  // Get all unnotified interests for this product
  const interests = await prisma.stockInterest.findMany({
    where: { productId, notified: false },
    select: { id: true, email: true },
  });

  if (interests.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No subscribers to notify" });
  }

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "info@signallaboratories.co.uk";
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://signallaboratories.co.uk";

  let sent = 0;
  const failed: string[] = [];

  for (const interest of interests) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: interest.email }] }],
          from: { email: FROM_EMAIL, name: "Signal Laboratories" },
          subject: `✅ Back in stock: ${product.name}`,
          content: [
            {
              type: "text/html",
              value: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0B1220;">
  <div style="border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; margin: 0;">Signal Laboratories</h1>
  </div>
  <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Good news — it's back in stock</h2>
  <p style="color: #475569; margin-bottom: 24px;">You asked us to let you know when <strong>${product.name}</strong> was back in stock. It's available now.</p>
  <a href="${SITE_URL}/products/${product.id}" style="display: inline-block; background: #0B1220; color: #fff; padding: 12px 28px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Shop now →</a>
  <p style="margin-top: 32px; font-size: 12px; color: #94A3B8;">For laboratory and analytical research purposes only. You received this email because you signed up for stock alerts on signallaboratories.co.uk.</p>
</body>
</html>`,
            },
          ],
        }),
      });

      if (res.ok || res.status === 202) {
        await prisma.stockInterest.update({
          where: { id: interest.id },
          data: { notified: true },
        });
        sent++;
      } else {
        failed.push(interest.email);
      }
    } catch {
      failed.push(interest.email);
    }
  }

  return NextResponse.json({ ok: true, sent, failed: failed.length, total: interests.length });
}
