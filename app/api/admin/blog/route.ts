// app/api/admin/blog/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Allows nested slugs: guides/abc-def/ghi */
const SLUG_RE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/** Allow /uploads/blog/... OR https://... */
const HERO_URL_RE =
  /^(\/uploads\/blog\/[a-z0-9/_-]+\.(?:jpg|jpeg|png|webp))$|^(https?:\/\/)/i;

const RESERVED_FIRST_SEGMENTS = new Set(["new", "edit"]);

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

function normalizeNullableString(input: unknown) {
  const s = clean(input);
  return s ? s : null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

const CategorySchema = z
  .string()
  .max(80, "Category too long")
  .transform((v) => clean(v).toLowerCase())
  .refine((v) => !v || SLUG_RE.test(v), { message: "Invalid category format" });

const HeroUrlSchema = z
  .string()
  .max(500, "Hero image URL too long")
  .refine((v) => HERO_URL_RE.test(v), { message: "Invalid hero image URL" });

const CreateSchema = z
  .object({
    title: z.string().min(3).max(160),
    slug: z.string().min(1).max(220),

    // ✅ new fields
    category: CategorySchema.optional().nullable(),

    excerpt: z.string().max(500).optional().nullable(),
    contentMarkdown: z.string().min(20),

    seoTitle: z.string().max(160).optional().nullable(),
    seoDescription: z.string().max(320).optional().nullable(),

    heroImageUrl: HeroUrlSchema.optional().nullable(),
    heroThumbUrl: HeroUrlSchema.optional().nullable(),
    heroImageAlt: z.string().max(200).optional().nullable(),
    heroImageWidth: z.number().int().positive().max(10000).optional().nullable(),
    heroImageHeight: z.number().int().positive().max(10000).optional().nullable(),

    published: z.boolean().optional(),
  })
  .transform((v) => {
    const slug = normalizeSlug(v.slug);
    return {
      ...v,
      title: clean(v.title),
      slug,
      category: normalizeNullableString(v.category),

      excerpt: normalizeNullableString(v.excerpt),
      seoTitle: normalizeNullableString(v.seoTitle),
      seoDescription: normalizeNullableString(v.seoDescription),

      heroImageUrl: normalizeNullableString(v.heroImageUrl),
      heroThumbUrl: normalizeNullableString(v.heroThumbUrl),
      heroImageAlt: normalizeNullableString(v.heroImageAlt),

      heroImageWidth:
        typeof v.heroImageWidth === "number" ? v.heroImageWidth : null,
      heroImageHeight:
        typeof v.heroImageHeight === "number" ? v.heroImageHeight : null,

      published: Boolean(v.published),
    };
  })
  .superRefine((v, ctx) => {
    // slug format
    if (!SLUG_RE.test(v.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "Invalid slug format",
      });
    }

    // reserved first segment
    const first = v.slug.split("/")[0] || "";
    if (RESERVED_FIRST_SEGMENTS.has(first)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "Slug uses a reserved path",
      });
    }
  });

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const posts = await prisma.blogPost.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      published: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,

      // ✅ now return these so admin list can show them
      category: true,
      heroImageUrl: true,
      heroThumbUrl: true,
      readingTimeMins: true,
    },
  });

  return NextResponse.json({ ok: true, posts });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;
  const now = new Date();

  // Unique slug
  const existing = await prisma.blogPost.findUnique({ where: { slug: v.slug } });
  if (existing) {
    return conflict("Slug already exists", { slug: v.slug });
  }

  // ✅ compute these on create (so posts are “ready” immediately)
  const readingTimeMins = estimateReadingTimeMinutes(v.contentMarkdown);
  const tocJson = JSON.stringify(buildToc(v.contentMarkdown));

  const created = await prisma.blogPost.create({
    data: {
      title: v.title,
      slug: v.slug,
      category: v.category,

      excerpt: v.excerpt,
      contentMarkdown: v.contentMarkdown,

      seoTitle: v.seoTitle,
      seoDescription: v.seoDescription,

      heroImageUrl: v.heroImageUrl,
      heroThumbUrl: v.heroThumbUrl,
      heroImageAlt: v.heroImageAlt,
      heroImageWidth: v.heroImageWidth,
      heroImageHeight: v.heroImageHeight,

      readingTimeMins,
      tocJson,

      published: v.published,
      publishedAt: v.published ? now : null,
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json({ ok: true, created });
}