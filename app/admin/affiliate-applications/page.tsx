import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

async function approveApplication(id: string) {
  "use server";
  const app = await prisma.affiliateApplication.findUnique({ where: { id } });
  if (!app) return;

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  // Create or find user account for the affiliate
  let user = await prisma.user.findUnique({ where: { email: app.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: app.email,
        password: hashedPassword,
        role: "USER",
      },
    });
  }

  // Create affiliate account linked to user
  const affiliate = await prisma.affiliate.create({
    data: {
      code: app.requestedCode,
      name: app.name,
      email: app.email,
      website: app.website,
      instagram: app.instagram,
      tiktok: app.tiktok,
      youtube: app.youtube,
      status: "APPROVED",
      isActive: true,
      defaultRateBps: 1000,
      userId: user.id,
    },
  });

  // Create wallet
  await prisma.affiliateWallet.create({
    data: { affiliateId: affiliate.id },
  });

  // Update application
  await prisma.affiliateApplication.update({
    where: { id },
    data: { status: "APPROVED", affiliateId: affiliate.id },
  });

  // Email affiliate their login details
  try {
    await sendEmail({
      to: app.email,
      subject: "Your Signal Labs affiliate account is approved",
      text: `Hi ${app.name},

Your affiliate application has been approved.

Your referral code is: ${app.requestedCode}

You can log in to your affiliate dashboard at:
https://signallaboratories.co.uk/affiliate/login

Your login details:
Email: ${app.email}
Temporary password: ${tempPassword}

Please change your password after logging in.

Your referral link:
https://signallaboratories.co.uk/?ref=${app.requestedCode}

You earn 10% commission on every new customer order placed through your link.

If you have any questions, contact support@signallaboratories.co.uk

Signal Labs`,
    });
  } catch (e) {
    console.error("Failed to send approval email:", e);
  }

  revalidatePath("/admin/affiliate-applications");
}

async function rejectApplication(id: string) {
  "use server";
  await prisma.affiliateApplication.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin/affiliate-applications");
}

export default async function AffiliateApplicationsPage() {
  const applications = await prisma.affiliateApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const pending = applications.filter((a) => a.status === "PENDING");
  const reviewed = applications.filter((a) => a.status !== "PENDING");

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Affiliate Applications</h1>
      <p className="mt-1 text-sm text-white/50">
        {pending.length} pending, {reviewed.length} reviewed
      </p>

      {pending.length === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
          No pending applications.
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-6 grid gap-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Pending</h2>
          {pending.map((app) => (
            <div key={app.id} className="rounded-2xl border border-yellow-400/20 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-base font-semibold text-white">{app.name}</div>
                  <div className="text-sm text-white/60">{app.email}</div>
                  <div className="mt-1 text-sm text-yellow-400 font-mono">{app.requestedCode}</div>
                  <div className="mt-2 text-xs text-white/40">Applied {formatDate(app.createdAt)}</div>
                </div>
                <div className="flex gap-2">
                  <form action={approveApplication.bind(null, app.id)}>
                    <button
                      type="submit"
                      className="rounded-full bg-yellow-400 text-black px-4 py-2 text-sm font-semibold hover:opacity-90"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectApplication.bind(null, app.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-white/20 text-white/70 px-4 py-2 text-sm font-semibold hover:bg-white/5"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-white/50">
                {app.website && <div>Website: <span className="text-white/70">{app.website}</span></div>}
                {app.instagram && <div>Instagram: <span className="text-white/70">{app.instagram}</span></div>}
                {app.tiktok && <div>TikTok: <span className="text-white/70">{app.tiktok}</span></div>}
                {app.youtube && <div>YouTube: <span className="text-white/70">{app.youtube}</span></div>}
                {(app as any).facebook && <div>Facebook: <span className="text-white/70">{(app as any).facebook}</span></div>}
                {app.notes && (() => {
                  try {
                    const parsed = JSON.parse(app.notes);
                    return parsed.notes ? (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-white/60">
                        {parsed.notes}
                      </div>
                    ) : null;
                  } catch {
                    return (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-white/60">
                        {app.notes}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="mt-10 grid gap-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Reviewed</h2>
          {reviewed.map((app) => (
            <div key={app.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-white">{app.name}</span>
                <span className="ml-2 text-sm text-white/40">{app.email}</span>
                <span className="ml-2 font-mono text-xs text-yellow-400">{app.requestedCode}</span>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                app.status === "APPROVED"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {app.status.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
