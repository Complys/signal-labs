export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json().catch(() => ({}));
    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findFirst({
      where: { token, expires: { gt: new Date() } },
    });

    if (!record) {
      return NextResponse.json({ error: "Reset link is invalid or has expired. Please request a new one." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email: record.email },
      data: { password: hashed },
    });

    await prisma.passwordResetToken.delete({ where: { id: record.id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
