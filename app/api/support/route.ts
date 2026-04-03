export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// web/app/api/support/route.ts
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

const TO = process.env.SUPPORT_TO_EMAIL || "info@signallaboratories.co.uk";
const FROM = process.env.SUPPORT_FROM_EMAIL || "info@signallaboratories.co.uk";

// Optional auto-reply controls
const AUTOREPLY_ENABLED = (process.env.SUPPORT_AUTOREPLY_ENABLED || "true") === "true";
const AUTOREPLY_FROM = process.env.SUPPORT_AUTOREPLY_FROM || FROM;
const AUTOREPLY_SUBJECT = process.env.SUPPORT_AUTOREPLY_SUBJECT || "We’ve received your enquiry ✅";
const PRODUCTS_URL = process.env.SUPPORT_AUTOREPLY_PRODUCTS_URL || "";
const SPECIALS_URL = process.env.SUPPORT_AUTOREPLY_SPECIALS_URL || "";
const SUPPORT_URL = process.env.SUPPORT_AUTOREPLY_SUPPORT_URL || process.env.SITE_URL || "";

/**
 * IMPORTANT SECURITY NOTE:
 * If you ever pasted your SendGrid API key into chat or screenshots, rotate it in SendGrid immediately
 * and update your .env.local / hosting environment with the new key.
 */

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(email: string) {
  // simple + reliable enough for contact form
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pickClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined
  );
}

async function verifyTurnstile(token: string, ip?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Dev-friendly: if no secret is configured, skip verification
  if (!secret) return { ok: true as const, skipped: true as const };

  if (!token) return { ok: false as const, error: "Please complete the verification check." };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json().catch(() => null)) as
    | { success?: boolean; "error-codes"?: string[] }
    | null;

  if (!data?.success) {
    // Do NOT leak exact codes to the user (helps attackers).
    const codes = Array.isArray((data as any)?.["error-codes"])
      ? (data as any)["error-codes"].join(", ")
      : "unknown";
    console.warn("Turnstile failed:", codes);
    return { ok: false as const, error: "Verification failed. Please try again." };
  }

  return { ok: true as const, skipped: false as const };
}

function buildSupportEmailHtml(args: {
  name: string;
  email: string;
  subject: string;
  message: string;
  turnstile: "verified" | "skipped";
}) {
  const n = escapeHtml(args.name);
  const e = escapeHtml(args.email);
  const s = escapeHtml(args.subject);
  const m = escapeHtml(args.message);

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.5;">
    <h2 style="margin:0 0 12px 0;">New support enquiry</h2>

    <p style="margin:0 0 6px 0;"><strong>Name:</strong> ${n}</p>
    <p style="margin:0 0 6px 0;"><strong>Email:</strong> ${e}</p>
    <p style="margin:0 0 12px 0;"><strong>Subject:</strong> ${s}</p>

    <div style="padding:12px;border:1px solid #eee;border-radius:12px;background:#fafafa;">
      <pre style="margin:0;white-space:pre-wrap;">${m}</pre>
    </div>

    <p style="margin:12px 0 0 0;color:#666;font-size:12px;">
      Turnstile: ${args.turnstile}
    </p>
  </div>
  `;
}

function buildSupportEmailText(args: { name: string; email: string; subject: string; message: string }) {
  return `New support enquiry

Name: ${args.name}
Email: ${args.email}
Subject: ${args.subject}

Message:
${args.message}
`;
}

function button(label: string, url: string) {
  if (!url) return "";
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;font-size:14px">${escapeHtml(
    label
  )}</a>`;
}

function link(label: string, url: string) {
  if (!url) return "";
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" style="color:#111;font-weight:700;text-decoration:none">${escapeHtml(
    label
  )}</a>`;
}

function buildAutoReplyHtml(args: { name: string; subject: string; message: string }) {
  const business = escapeHtml(process.env.BUSINESS_NAME || "Signal Laboratories");

  const safeName = escapeHtml(args.name || "there");
  const safeSubject = escapeHtml(args.subject || "");
  const safeMessage = escapeHtml(args.message || "").replaceAll("\n", "<br/>");

  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:#f6f8fb; padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,.08);border-radius:24px;overflow:hidden;">
      <div style="padding:22px 24px;border-bottom:1px solid rgba(0,0,0,.08);">
        <div style="font-size:18px;font-weight:900;letter-spacing:-0.02em;">${business}</div>
        <div style="margin-top:6px;color:rgba(0,0,0,.62);font-size:14px;">We’ve received your enquiry</div>
      </div>

      <div style="padding:22px 24px;">
        <p style="margin:0 0 10px 0;font-size:15px;color:#111;">Hi ${safeName},</p>

        <p style="margin:0 0 14px 0;font-size:15px;color:rgba(0,0,0,.75);">
          Thanks for getting in touch — we’ve received your message and a member of the team will reply as soon as possible.
        </p>

        <div style="margin:18px 0;padding:14px 14px;border-radius:18px;background:#f6f8fb;border:1px solid rgba(0,0,0,.07);">
          <div style="font-size:13px;color:rgba(0,0,0,.55);margin-bottom:6px;">Your message</div>
          <div style="font-size:14px;color:#111;"><strong>Subject:</strong> ${safeSubject}</div>
          <div style="margin-top:8px;font-size:14px;color:rgba(0,0,0,.8);line-height:1.5;">${safeMessage}</div>
        </div>

        <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
          ${button("Browse products", PRODUCTS_URL)}
          ${button("Special offers", SPECIALS_URL)}
          ${button("Support", SUPPORT_URL)}
        </div>

        <p style="margin:18px 0 0 0;font-size:13px;color:rgba(0,0,0,.55);line-height:1.5;">
          Quick links:
          ${link("Products", PRODUCTS_URL)}
          ${(PRODUCTS_URL && SPECIALS_URL) ? " • " : ""}
          ${link("Special offers", SPECIALS_URL)}
          ${((PRODUCTS_URL || SPECIALS_URL) && SUPPORT_URL) ? " • " : ""}
          ${link("Support", SUPPORT_URL)}
        </p>
      </div>

      <div style="padding:16px 24px;border-top:1px solid rgba(0,0,0,.08);color:rgba(0,0,0,.45);font-size:12px;">
        This is an automated confirmation. If you need to add more info, please submit another message via our support page.
      </div>
    </div>
  </div>
  `;
}

function buildAutoReplyText(args: { name: string; subject: string; message: string }) {
  const business = process.env.BUSINESS_NAME || "Signal Laboratories";
  return `${business}

Hi ${args.name || "there"},

Thanks for getting in touch — we’ve received your message and will reply as soon as possible.

Subject: ${args.subject}

Message:
${args.message}

Links:
Products: ${PRODUCTS_URL}
Special offers: ${SPECIALS_URL}
Support: ${SUPPORT_URL}
`;
}

export async function POST(req: Request) {
  try {
    // ---- config checks ----
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Email service not configured." },
        { status: 500 }
      );
    }

    if (!FROM || !TO) {
      return NextResponse.json(
        { ok: false, error: "Email service not configured." },
        { status: 500 }
      );
    }

    // ---- accept JSON only ----
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const turnstileToken = String(body.turnstileToken || "").trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ ok: false, error: "Please complete all fields." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ ok: false, error: "Message is too long." }, { status: 400 });
    }

    // ---- turnstile verification ----
    const ip = pickClientIp(req);
    const v = await verifyTurnstile(turnstileToken, ip);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }

    // ---- send emails ----
    sgMail.setApiKey(apiKey);

    // 1) Send to your support inbox (replyTo is the customer)
    await sgMail.send({
      to: TO,
      from: FROM, // should be verified sender/domain
      replyTo: { email, name },
      subject: `Support enquiry: ${subject}`,
      text: buildSupportEmailText({ name, email, subject, message }),
      html: buildSupportEmailHtml({
        name,
        email,
        subject,
        message,
        turnstile: v.skipped ? "skipped" : "verified",
      }),
    });

    // 2) Auto-reply back to the customer (optional)
    if (AUTOREPLY_ENABLED) {
      await sgMail.send({
        to: email,
        from: AUTOREPLY_FROM, // should be verified too
        subject: AUTOREPLY_SUBJECT,
        text: buildAutoReplyText({ name, subject, message }),
        html: buildAutoReplyHtml({ name, subject, message }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Log details server-side, return generic message to client
    const sgErrors = err?.response?.body?.errors;
    if (sgErrors) console.error("SendGrid error:", sgErrors);
    else console.error("Support route error:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          "Email delivery failed. Please try again in a moment. If the issue continues, contact us directly.",
      },
      { status: 500 }
    );
  }
}
