import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintBar from "./PrintBar";

export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}
function fmtLine(...parts: Array<string | null | undefined>) {
  return parts.map(clean).filter(Boolean).join(", ");
}

export default async function OrderLabelPage(props: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const params = await Promise.resolve(props.params);
  const id = params?.id;
  if (!id) return notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,

      name: true,
      phone: true,
      email: true,

      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      country: true,

      // if you add these later, keep them:
      // companyName: true,
      // safeplace: true,
      // deliveryNotes: true,
    },
  });

  if (!order) return notFound();

  const name = clean(order.name) || "Customer";
  const phone = clean(order.phone);
  const email = clean(order.email);

  const addrA = fmtLine(order.addressLine1);
  const addrB = fmtLine(order.addressLine2);
  const addrC = fmtLine(order.city, order.postcode);
  const addrD = fmtLine(order.country);

  return (
    <html lang="en">
      <head>
        <title>Shipping label · {order.id}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            :root { --w: 4in; --h: 6in; --pad: 10mm; }
            @page { size: 4in 6in; margin: 0; }

            body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#000; background:#fff; }
            .screenWrap { min-height:100vh; display:grid; place-items:center; background:#f5f6f7; padding:24px; }
            .label { width:var(--w); height:var(--h); box-sizing:border-box; padding:var(--pad); background:#fff; border:1px solid rgba(0,0,0,0.15); }

            .topBar { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10mm; }
            .brand { font-weight:900; letter-spacing:0.08em; font-size:14px; text-transform:uppercase; }
            .meta { text-align:right; font-size:12px; line-height:1.3; }

            .divider { margin: 10mm 0 8mm; border-top:2px solid #000; }
            .toTitle { font-size:12px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:4mm; }
            .name { font-size:22px; font-weight:900; line-height:1.1; margin-bottom:4mm; }
            .addr { font-size:16px; font-weight:700; line-height:1.35; }
            .contact { margin-top:10mm; font-size:12px; line-height:1.4; }
            .hint { font-size:12px; color: rgba(0,0,0,0.75); }

            @media print {
              .screenWrap { display:block; padding:0; background:#fff; }
              .label { border:none; }
              .printBar { display:none; }
            }
          `,
          }}
        />
      </head>
      <body>
        <div className="screenWrap">
          <div className="label">
            <div className="topBar">
              <div>
                <div className="brand">AutoComps</div>
                <div className="hint">Shipping label</div>
              </div>
              <div className="meta">
                <div>
                  <strong>Order:</strong> {order.id}
                </div>
                <div>
                  <strong>Status:</strong> {order.status}
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="toTitle">Ship to</div>
            <div className="name">{name}</div>

            <div className="addr">
              {addrA && <div>{addrA}</div>}
              {addrB && <div>{addrB}</div>}
              {addrC && <div>{addrC}</div>}
              {addrD && <div>{addrD}</div>}
              {!addrA && !addrB && !addrC && !addrD && (
                <div style={{ fontWeight: 700 }}>Address not saved yet.</div>
              )}
            </div>

            {(phone || email) && (
              <div className="contact">
                {phone && (
                  <div>
                    <strong>Phone:</strong> {phone}
                  </div>
                )}
                {email && (
                  <div>
                    <strong>Email:</strong> {email}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="printBar">
            <PrintBar backHref={`/admin/orders/${order.id}`} />
          </div>
        </div>
      </body>
    </html>
  );
}
