import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const interests = await prisma.stockInterest.findMany({
    where: { notified: false },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true, stock: true, isActive: true } },
    },
  });

  const byProduct = interests.reduce((acc, i) => {
    const key = i.productId;
    if (!acc[key]) acc[key] = { product: i.product, emails: [] };
    acc[key].emails.push(i.email);
    return acc;
  }, {} as Record<string, { product: { name: string; stock: number; isActive: boolean }; emails: string[] }>);

  const total = interests.length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Stock Waitlist</h1>
      <p className="mt-1 text-sm text-white/50">
        {total} customer{total === 1 ? "" : "s"} waiting for out-of-stock products.
      </p>

      {total === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
          No waitlist entries yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {Object.entries(byProduct).map(([productId, { product, emails }]) => (
            <div key={productId} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-white">{product.name}</div>
                  <div className="mt-1 text-sm text-white/50">
                    Current stock: <span className={product.stock > 0 ? "text-green-400" : "text-red-400"}>{product.stock}</span>
                  </div>
                  <div className="mt-1 text-sm text-yellow-400 font-semibold">
                    {emails.length} customer{emails.length === 1 ? "" : "s"} waiting
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-1">
                {emails.map((email) => (
                  <div key={email} className="text-sm text-white/60 font-mono">
                    {email}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
