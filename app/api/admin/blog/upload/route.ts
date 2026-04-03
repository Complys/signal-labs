import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import path from "path";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) return badRequest("No file uploaded");

  // Size limit
  if (file.size > MAX_FILE_SIZE) return badRequest("File too large (max 5MB)");

  // MIME validation
  if (!ALLOWED_MIME.has(file.type)) return badRequest("Unsupported file type");

  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "blog");
  await mkdir(uploadsDir, { recursive: true });

  const id = randomUUID();

  // Read metadata (width/height)
  const img = sharp(buffer, { failOn: "none" });
  const meta = await img.metadata();

  // 1) Optimized main image (webp, max 1600px wide)
  const mainName = `${id}.webp`;
  const mainPath = path.join(uploadsDir, mainName);

  await img
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(mainPath);

  // 2) Thumb image (webp, max 600px wide)
  const thumbName = `${id}-thumb.webp`;
  const thumbPath = path.join(uploadsDir, thumbName);

  await sharp(buffer, { failOn: "none" })
    .resize({ width: 600, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(thumbPath);

  return NextResponse.json({
    ok: true,
    url: `/uploads/blog/${mainName}`,
    thumbUrl: `/uploads/blog/${thumbName}`,
    width: meta.width ?? null,
    height: meta.height ?? null,
  });
}