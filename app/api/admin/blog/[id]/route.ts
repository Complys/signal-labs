import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Allows nested slugs: guides/abc-def/ghi */
const SLUG_RE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/**
 * Allow:
 * - /uploads/blog/anything.(jpg|jpeg|png|webp)
 * - https://...
 *
 * NOTE: this also supports your optimized outputs like:
 * /uploads/blog/<uuid>.webp
 * /uploads/blog/<uuid>-thumb.webp
 */
const HERO_URL_RE =
  /^(\/uploads\/blog\/[a-z0-9/_-]+\.(?:jpg|jpeg|png|webp))$|^(https?:\/\/)/i;

type RouteContext = { params: Promise<{ id: string }> };

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeSlug(input: unknown) {
  return clean(input)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
}

function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function notFound(message = "Not found") {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

function badRequest(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ?? {}) },
    { status: 400 }
  );
}

function conflict(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ?? {}) },
    { status: 409 }
  );
}

const SlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(220, "Slug too long")
  .transform((v) => normalizeSlug(v))
  .refine((v) => SLUG_RE.test(v), { message: "Invalid slug format" });

const HeroUrlSchema = z
  .string()
  .max(500, "Hero image URL too long")
  .refine((v) => HERO_URL_RE.test(v), { message: "Invalid hero image URL" });

const CategorySchema = z
  .string()
  .max(80, "Category too long")
  .transform((v) => clean(v).toLowerCase())
  .refine((v) => !v || SLUG_RE.test(v), {
    message: "Invalid category format",
  });

/**
 * PATCH = partial update
 * optional() means "may be omitted". If provided, it must validate.
 */
const PatchSchema = z.object({
  title: z.string().min(3).max(160).optional(),
  slug: SlugSchema.optional(),

  category: CategorySchema.optional().nullable(),

  excerpt: z.string().max(500).optional().nullable(),
  contentMarkdown: z.string().min(20).optional(),

  seoTitle: z.string().max(160).optional().nullable(),
  seoDescription: z.string().max(320).optional().nullable(),

  heroImageUrl: HeroUrlSchema.optional().nullable(),
  heroThumbUrl: HeroUrlSchema.optional().nullable(),
  heroImageAlt: z.string().max(200).optional().nullable(),
  heroImageWidth: z.number().int().positive().max(10000).optional().nullable(),
  heroImageHeight: z.number().int().positive().max(10000).optional().nullable(),

  published: z.boolean().optional(),
});

function normalizeNullableString(v: unknown) {
  const s = clean(v);
  return s ? s : null;
}

function estimateReadingTimeMinutes(markdown: string) {
  const text = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-()[\]~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text ? text.split(" ").length : 0;
  const wpm = 220;
  return Math.max(1, Math.round(words / wpm));
}

type TocItem = { level: number; text: string; id: string };

function slugifyHeading(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildToc(markdown: string): TocItem[] {
  const lines = String(markdown || "").split("\n");
  const out: TocItem[] = [];
  const seen = new Map<string, number>();

  for (const line of lines) {
    const m = line.match(/^(#{2,4})\s+(.+?)\s*$/); // H2-H4
    if (!m) continue;

    const level = m[1].length;
    const rawText = m[2].replace(/\s+#*$/, "").trim();
    if (!rawText) continue;

    const base = slugifyHeading(rawText);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);

    const id = count > 1 ? `${base}-${count}` : base;
    out.push({ level, text: rawText, id });
  }

  return out;
}

export async function GET(_req: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await context.params;
  const safeId = clean(id);
  if (!safeId) return badRequest("Missing id");

  const post = await prisma.blogPost.findUnique({ where: { id: safeId } });
  if (!post) return notFound();

  return ok({ post });
}

export async function PATCH(req: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await context.params;
  const safeId = clean(id);
  if (!safeId) return badRequest("Missing id");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  const existing = await prisma.blogPost.findUnique({ where: { id: safeId } });
  if (!existing) return notFound();

  // ---- Slug rules (only when changing)
  if (typeof v.slug === "string" && v.slug !== existing.slug) {
    const reserved = new Set(["new", "edit"]);
    const firstSegment = v.slug.split("/")[0];
    if (reserved.has(firstSegment)) {
      return badRequest("Slug uses a reserved path", { slug: v.slug });
    }

    const dupe = await prisma.blogPost.findUnique({ where: { slug: v.slug } });
    if (dupe && dupe.id !== safeId) {
      return conflict("Slug already exists", { slug: v.slug });
    }
  }

  // ---- Publishing timestamps
  const nextPublished =
    typeof v.published === "boolean" ? v.published : existing.published;

  let nextPublishedAt = existing.publishedAt;
  if (!existing.published && nextPublished) nextPublishedAt = new Date();
  if (existing.published && !nextPublished) nextPublishedAt = null;

  // ---- Build update data (only include fields that were provided)
  const data: any = {
    published: nextPublished,
    publishedAt: nextPublishedAt,
  };

  if (v.title !== undefined) data.title = clean(v.title);
  if (v.slug !== undefined) data.slug = v.slug; // already normalized by schema

  if (v.category !== undefined) data.category = normalizeNullableString(v.category);

  if (v.excerpt !== undefined) data.excerpt = normalizeNullableString(v.excerpt);
  if (v.contentMarkdown !== undefined)
    data.contentMarkdown = String(v.contentMarkdown ?? "");

  if (v.seoTitle !== undefined) data.seoTitle = normalizeNullableString(v.seoTitle);
  if (v.seoDescription !== undefined)
    data.seoDescription = normalizeNullableString(v.seoDescription);

  if (v.heroImageUrl !== undefined)
    data.heroImageUrl = normalizeNullableString(v.heroImageUrl);
  if (v.heroThumbUrl !== undefined)
    data.heroThumbUrl = normalizeNullableString(v.heroThumbUrl);
  if (v.heroImageAlt !== undefined)
    data.heroImageAlt = normalizeNullableString(v.heroImageAlt);

  if (v.heroImageWidth !== undefined)
    data.heroImageWidth = v.heroImageWidth ?? null;
  if (v.heroImageHeight !== undefined)
    data.heroImageHeight = v.heroImageHeight ?? null;

  // ---- Auto compute reading time + TOC when markdown changes
  if (v.contentMarkdown !== undefined) {
    const md = String(v.contentMarkdown ?? "");
    data.readingTimeMins = estimateReadingTimeMinutes(md);
    data.tocJson = JSON.stringify(buildToc(md));
  }

  const updated = await prisma.blogPost.update({
    where: { id: safeId },
    data,
  });

  return ok({ post: updated });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await context.params;
  const safeId = clean(id);
  if (!safeId) return badRequest("Missing id");

  const existing = await prisma.blogPost.findUnique({ where: { id: safeId } });
  if (!existing) return notFound();

  await prisma.blogPost.delete({ where: { id: safeId } });

  return ok();
}