import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  const header = ["id", "name", "price", "stock", "isActive"];
  const rows = products.map((p) => [
    p.id,
    p.name,
    p.price,
    p.stock,
    p.isActive,
  ]);

  const csv =
    [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="products.csv"`,
    },
  });
}
