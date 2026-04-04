import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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

    const filename = `products/${crypto.randomBytes(16).toString("hex")}.${ext}`;
    const bytes = Buffer.from(await f.arrayBuffer());

    const blob = await put(filename, bytes, {
      access: "public",
      contentType: f.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
