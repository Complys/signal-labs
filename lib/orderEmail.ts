import sgMail from "@sendgrid/mail";
import fs from "fs";
import path from "path";

export const EMAIL_ENABLED = (process.env.ORDERS_EMAIL_ENABLED || "true") === "true";

const DEFAULT_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.SITE_URL ||
  "http://localhost:3000";

const FROM =
  process.env.ORDERS_FROM_EMAIL ||
  process.env.SUPPORT_FROM_EMAIL ||
  "Signal Laboratories <info@signallaboratories.co.uk>";

const REPLY_TO =
  process.env.ORDERS_REPLY_TO_EMAIL ||
  process.env.SUPPORT_TO_EMAIL ||
  "info@signallaboratories.co.uk";

/**
 * Email “channel” (what kind of email this is)
 * - receipt: payment/receipt communications (to Order.receiptEmail)
 * - fulfilment: shipping/tracking updates (to Order.email)
 */
export type EmailChannel = "receipt" | "fulfilment";

export type EmailItem = {
  name: string;
  quantity: number;
  unitPricePennies: number;
  lineTotalPennies: number;
};

export type SendOrderEmailArgs = {
  to: string;
  orderId: string;

  /** PAID or SHIPPED (kept strict on purpose) */
  status: "PAID" | "SHIPPED";

  trackingNo?: string | null;
  trackingUrl?: string | null;

  amountTotalPennies?: number;
  siteUrl?: string;

  customerName?: string | null;

  items?: EmailItem[];

  /** Optional override */
  subject?: string;

  /**
   * Optional override:
   * - if omitted: PAID => receipt, SHIPPED => fulfilment
   */
  channel?: EmailChannel;
};

export type SendOrderEmailResult = {
  accepted: boolean;
  statusCode: number | null;

  providerMessageId?: string | null;

  subject: string;
  to: string;
  status: "PAID" | "SHIPPED";
  channel: EmailChannel;

  /** For debugging/logging */
  responseHeaders?: Record<string, any> | null;
};

/** ---------- helpers ---------- */
function baseUrl(url?: string) {
  return String(url || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

// Safe for HTML text nodes
function escapeHtml(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Safe for HTML attribute values (href="")
function escapeAttr(input: string) {
  return escapeHtml(input);
}

function formatGBPFromPennies(pennies: number) {
  const safe = Number.isFinite(pennies) ? pennies : 0;
  return `£${(safe / 100).toFixed(2)}`;
}

function shortOrderId(id: string) {
  const safe = String(id || "");
  return safe ? `#${safe.slice(-8).toUpperCase()}` : "#—";
}

let SENDGRID_READY = false;
function ensureSendgrid() {
  if (SENDGRID_READY) return true;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;
  sgMail.setApiKey(apiKey);
  SENDGRID_READY = true;
  return true;
}

type InlineAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition: "inline";
  content_id: string;
};

let LOGO_CACHE: InlineAttachment | null | undefined = undefined;

function loadLogoAttachmentBestEffort(): InlineAttachment | null {
  if (LOGO_CACHE !== undefined) return LOGO_CACHE;

  try {
    const p = path.join(process.cwd(), "public", "signal-logo.png");
    if (!fs.existsSync(p)) {
      LOGO_CACHE = null;
      return null;
    }

    const buf = fs.readFileSync(p);
    LOGO_CACHE = {
      content: buf.toString("base64"),
      filename: "signal-logo.png",
      type: "image/png",
      disposition: "inline",
      content_id: "signalLogo",
    };
    return LOGO_CACHE;
  } catch {
    LOGO_CACHE = null;
    return null;
  }
}

/**
 * Make sure URLs are clickable in email:
 * - trims
 * - if "/path" => root + "/path"
 * - if "www.domain.com/.." => "https://www.domain.com/.."
 * - if missing scheme but looks like a domain => "https://..."
 * - otherwise returns trimmed string
 */
function normalizeUrl(raw: string | null | undefined, root: string) {
  const u = String(raw || "").trim();
  if (!u) return "";

  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${root}${u}`;
  if (u.toLowerCase().startsWith("www.")) return `https://${u}`;

  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(u)) return `https://${u}`;

  return u;
}

function buildItemsText(items: EmailItem[]) {
  if (!items.length) return "";
  return (
    "\n\nItems:\n" +
    items
      .map((i) => `• ${i.name} × ${i.quantity} — ${formatGBPFromPennies(i.lineTotalPennies)}`)
      .join("\n")
  );
}

function buildItemsHtml(items: EmailItem[]) {
  if (!items.length) return "";

  return `
    <div style="margin-top:18px;">
      <div style="font-weight:700;font-size:16px;margin:0 0 10px 0;">Items</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th align="left" style="padding:10px 0;border-bottom:1px solid #eee;">Item</th>
            <th align="center" style="padding:10px 0;border-bottom:1px solid #eee;">Qty</th>
            <th align="right" style="padding:10px 0;border-bottom:1px solid #eee;">Line total</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (i) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f3f3f3;">
                  ${escapeHtml(i.name)}
                </td>
                <td align="center" style="border-bottom:1px solid #f3f3f3;">
                  ${Number(i.quantity) || 0}
                </td>
                <td align="right" style="border-bottom:1px solid #f3f3f3;">
                  ${escapeHtml(formatGBPFromPennies(Number(i.lineTotalPennies) || 0))}
                </td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildBulletproofButtonHtml(href: string, label: string) {
  const safeHref = escapeAttr(href);
  const safeLabel = escapeHtml(label);

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      <tr>
        <td align="left" bgcolor="#111111" style="border-radius:12px;">
          <a href="${safeHref}"
             target="_blank"
             rel="noopener noreferrer"
             style="
               display:inline-block;
               padding:12px 16px;
               font-weight:700;
               font-size:14px;
               text-decoration:none;
               color:#ffffff;
               border-radius:12px;
             ">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function buildTrackingHtml(trackingNo: string, trackingUrlRaw: string, root: string) {
  const safeNo = escapeHtml(trackingNo || "—");
  const trackingUrl = normalizeUrl(trackingUrlRaw, root);

  return `
    <div style="margin-top:18px;padding:16px;border:1px solid #eee;border-radius:16px;background:#fafafa;">
      <div style="font-weight:700;margin:0 0 8px 0;">Tracking</div>

      <div style="font-size:14px;margin:0 0 10px 0;">
        <span style="color:#444;">Tracking number:</span>
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
          ${safeNo}
        </span>
      </div>

      ${
        trackingUrl
          ? `
        ${buildBulletproofButtonHtml(trackingUrl, "Track your parcel")}

        <div style="font-size:12px;color:#666;margin-top:10px;">
          If the button doesn’t work, copy and paste this link:<br/>
          <a href="${escapeAttr(trackingUrl)}" style="color:#0b62d6;word-break:break-all;" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(trackingUrl)}
          </a>
        </div>
      `
          : `<div style="font-size:13px;color:#666;">Tracking link will be added as soon as it’s available.</div>`
      }
    </div>
  `;
}

function buildAboutBlockHtml(channel: EmailChannel, status: "PAID" | "SHIPPED") {
  if (channel === "receipt") {
    return `
      <div style="margin-top:18px;padding:14px;border:1px solid #eee;border-radius:16px;background:#fafafa;">
        <div style="font-weight:700;margin:0 0 6px 0;">About this email</div>
        <div style="font-size:13px;color:#555;">
          This is a <strong>payment confirmation</strong> for your order.
          Shipping updates (tracking, dispatch) are sent separately to your fulfilment email.
        </div>
      </div>
    `;
  }

  if (status === "SHIPPED") {
    return `
      <div style="margin-top:18px;padding:14px;border:1px solid #eee;border-radius:16px;background:#fafafa;">
        <div style="font-weight:700;margin:0 0 6px 0;">About this email</div>
        <div style="font-size:13px;color:#555;">
          This is a <strong>shipping update</strong> for your order (tracking / dispatch).
          Your payment receipt may be sent separately.
        </div>
      </div>
    `;
  }

  return `
    <div style="margin-top:18px;padding:14px;border:1px solid #eee;border-radius:16px;background:#fafafa;">
      <div style="font-weight:700;margin:0 0 6px 0;">About this email</div>
      <div style="font-size:13px;color:#555;">
        This email address is used for <strong>Signal Labs order updates</strong>.
        Your payment receipt may be sent separately.
      </div>
    </div>
  `;
}

function getSendgridStatusCode(res: any): number | null {
  // sendgrid/mail returns an array: [response, body]
  // response has statusCode
  const r0 = Array.isArray(res) ? res[0] : res;
  const code = r0?.statusCode;
  return typeof code === "number" ? code : null;
}

function getSendgridHeaders(res: any): Record<string, any> | null {
  const r0 = Array.isArray(res) ? res[0] : res;
  const h = r0?.headers;
  return h && typeof h === "object" ? h : null;
}

function getSendgridMessageIdFromHeaders(headers: Record<string, any> | null | undefined) {
  if (!headers) return null;
  return (
    headers["x-message-id"] ||
    headers["X-Message-Id"] ||
    headers["X-Message-ID"] ||
    headers["x-message-id".toLowerCase()] ||
    null
  );
}

/**
 * Main send function.
 * Strict:
 * - status must be PAID or SHIPPED
 * - channel defaults: PAID => receipt, SHIPPED => fulfilment
 *
 * IMPORTANT:
 * - We only report accepted=true when SendGrid returns 202.
 * - We throw with details if SendGrid rejects.
 */
export async function sendOrderUpdateEmail(args: SendOrderEmailArgs): Promise<SendOrderEmailResult | void> {
  if (!EMAIL_ENABLED) return;
  if (!args?.to) return;

  const to = clean(args.to);
  if (!to) return;

  const status = String(args.status || "").trim().toUpperCase() as "PAID" | "SHIPPED";
  if (status !== "PAID" && status !== "SHIPPED") return;

  if (!ensureSendgrid()) {
    throw new Error("Missing SENDGRID_API_KEY");
  }

  const channel: EmailChannel = args.channel || (status === "PAID" ? "receipt" : "fulfilment");

  const root = baseUrl(args.siteUrl);
  const accountUrl = `${root}/account`;
  const orderShort = shortOrderId(args.orderId);

  const greeting = args.customerName?.trim() ? `Hi ${args.customerName.trim()},` : "Hi,";

  const items = Array.isArray(args.items) ? args.items : [];

  const totalLine =
    typeof args.amountTotalPennies === "number" ? `Total: ${formatGBPFromPennies(args.amountTotalPennies)}` : "";

  const trackingNo = clean(args.trackingNo);
  const trackingUrlRaw = clean(args.trackingUrl);
  const trackingUrlText = normalizeUrl(trackingUrlRaw, root);

  /** ---------- TEXT ---------- */
  const textIntro =
    status === "PAID"
      ? `Thanks — we’ve received your payment for order ${orderShort}.`
      : `Good news — your order ${orderShort} has been shipped.`;

  const trackingLines =
    status === "SHIPPED"
      ? `\n${trackingNo ? `Tracking number: ${trackingNo}\n` : ""}${trackingUrlText ? `Track your parcel: ${trackingUrlText}\n` : ""}`
      : "";

  const aboutText =
    channel === "receipt"
      ? "\nAbout this email:\n- This is a payment confirmation email.\n- Shipping/tracking updates are sent separately.\n"
      : "\nAbout this email:\n- This address receives Signal Labs shipping/tracking updates.\n- Your payment receipt may be sent separately.\n";

  const text = `
${greeting}

${textIntro}

${totalLine ? `${totalLine}\n` : ""}${trackingLines}
View your account: ${accountUrl}
${buildItemsText(items)}
${aboutText}

All products sold by Signal Labs are supplied strictly for laboratory and analytical research purposes only.
Not for human or veterinary consumption. Not intended to diagnose, treat, cure, or prevent any disease.
`.trim();

  /** ---------- HTML ---------- */
  const logoAttachment = loadLogoAttachmentBestEffort();
  const logoHtml = logoAttachment
    ? `<div style="text-align:center;margin-bottom:18px;">
         <img src="cid:signalLogo" alt="Signal Laboratories" style="max-width:180px;height:auto;" />
       </div>`
    : "";

  const itemsHtml = buildItemsHtml(items);
  const trackingBlock = status === "SHIPPED" ? buildTrackingHtml(trackingNo, trackingUrlRaw, root) : "";

  const headline = status === "PAID" ? "Payment received ✅" : "Your order has shipped ✅";
  const subline =
    status === "PAID"
      ? `Order <strong>${escapeHtml(orderShort)}</strong> is confirmed and being prepared.`
      : `Order <strong>${escapeHtml(orderShort)}</strong> is on its way.`;

  const aboutBlock = buildAboutBlockHtml(channel, status);

  const totalHtml =
    typeof args.amountTotalPennies === "number"
      ? `<div style="margin:0 0 14px 0;font-size:14px;color:#333;">
           <span style="color:#555;">Total:</span>
           <strong>${escapeHtml(formatGBPFromPennies(args.amountTotalPennies))}</strong>
         </div>`
      : "";

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.6;color:#111;max-width:640px;margin:0 auto;padding:0 10px;">
    ${logoHtml}

    <div style="border:1px solid #eee;border-radius:20px;padding:22px;background:#fff;">
      <p style="margin:0 0 12px 0;">${escapeHtml(greeting)}</p>

      <h2 style="margin:0 0 6px 0;font-size:22px;">${escapeHtml(headline)}</h2>
      <p style="margin:0 0 14px 0;color:#333;">${subline}</p>

      ${totalHtml}
      ${trackingBlock}
      ${itemsHtml}
      ${aboutBlock}

      <div style="margin-top:18px;font-size:14px;">
        View your account:
        <a href="${escapeAttr(accountUrl)}" style="color:#0b62d6;" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(accountUrl)}
        </a>
      </div>
    </div>

    <div style="margin:16px 0 0 0;font-size:12px;color:#666;text-align:center;">
      All products sold by Signal Labs are supplied strictly for laboratory and analytical research purposes only.
      Not for human or veterinary consumption. Not intended to diagnose, treat, cure, or prevent any disease.
    </div>
  </div>
  `;

  const subjectDefault =
    status === "PAID"
      ? `Signal Labs ${orderShort} • Payment received`
      : `Signal Labs ${orderShort} • Shipped`;

  const subject = clean(args.subject) || subjectDefault;

  const msg = {
    to,
    from: FROM,
    replyTo: REPLY_TO,
    subject,
    text,
    html,
    ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
  };

  try {
    const res = await sgMail.send(msg as any);

    const statusCode = getSendgridStatusCode(res);
    const headers = getSendgridHeaders(res);
    const providerMessageId = getSendgridMessageIdFromHeaders(headers);

    // 202 means "Accepted" by SendGrid
    const accepted = statusCode === 202;

    // If we didn't get 202, treat as a failure (so your API route logs FAILED)
    if (!accepted) {
      throw new Error(
        `SendGrid did not accept message (status=${statusCode ?? "unknown"}). Headers=${headers ? JSON.stringify(headers) : "null"}`
      );
    }

    return {
      accepted,
      statusCode,
      providerMessageId,
      subject,
      to,
      status,
      channel,
      responseHeaders: headers,
    };
  } catch (err: any) {
    // SendGrid throws rich errors: err.response.body
    const body = err?.response?.body;
    const extra =
      body ? ` | sendgrid_body=${typeof body === "string" ? body : JSON.stringify(body)}` : "";

    const msg = clean(err?.message || err) || "SendGrid error";
    throw new Error(`${msg}${extra}`);
  }
}