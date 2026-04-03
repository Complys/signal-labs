import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export async function GET() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "announcement_bar" } });
  const message = row?.value?.trim() ?? "";
  return NextResponse.json({ message });
}
