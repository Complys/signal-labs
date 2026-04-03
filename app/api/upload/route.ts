import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // file is a Blob (File) in Next runtime
    const f = file as File;

    if (!ALLOWED.has(f.type)) {
      return NextResponse.json({ error: "Only PNG/JPG/WEBP allowed" }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const ext =
      f.type === "image/png" ? "png" :
      f.type === "image/jpeg" ? "jpg" :
      "webp";

    const bytes = Buffer.from(await f.arrayBuffer());
    const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const fullPath = path.join(uploadsDir, filename);
    await fs.writeFile(fullPath, bytes);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
