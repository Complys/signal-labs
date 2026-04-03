"use server";

import { prisma } from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function toggleActive(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, select: { isActive: true } });
  if (!p) return;

  await prisma.product.update({
    where: { id },
    data: { isActive: !p.isActive },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function upsertProduct(formData: FormData) {
  const idRaw = formData.get("id")?.toString();
  const id = idRaw ? idRaw : null;

  const name = formData.get("name")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const image = formData.get("image")?.toString().trim() ?? "";
  const stripePriceId = formData.get("stripePriceId")?.toString().trim() ?? "";
  const price = Number(formData.get("price")?.toString() ?? 0);
  const stock = Number(formData.get("stock")?.toString() ?? 0);
  const isActive = formData.get("isActive") === "on";

  if (!name) throw new Error("Name is required");
  if (!Number.isFinite(price)) throw new Error("Price invalid");
  if (!Number.isFinite(stock)) throw new Error("Stock invalid");

  if (id) {
    await prisma.product.update({
      where: { id },
      data: { name, description, image, stripePriceId, price, stock, isActive },
    });
  } else {
    await prisma.product.create({
      data: { name, description, image, stripePriceId, price, stock, isActive },
    });
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
}
