export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// app/api/admin/upload/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getToken } from "next-auth/jwt";


const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function safeFileName(originalName: string) {
  const cleaned = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const ext = (path.extname(cleaned) || ".png").toLowerCase();
  const base = path.basename(cleaned, ext) || "upload";
  return `${base}-${Date.now()}${ext}`;
}

export async function POST(req: Request) {
  try {
    // 🔐 Protect upload endpoint (must be logged in + ADMIN)
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const role = (token as any)?.role ?? (token as any)?.user?.role;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPG, or WEBP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Max file size is 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure extension matches mime (basic safety)
    const extFromMime =
      file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
        ? ".webp"
        : ".jpg";

    const rawName = safeFileName(file.name);
    const filename =
      path.extname(rawName).toLowerCase() === extFromMime
        ? rawName
        : `${path.basename(rawName, path.extname(rawName))}${extFromMime}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
