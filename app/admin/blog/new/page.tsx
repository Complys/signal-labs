"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type React from "react";

type UploadOk = {
  ok: true;
  url: string;
  thumbUrl?: string;
  width?: number | null;
  height?: number | null;
};
type UploadFail = { ok?: false; error?: string };
type UploadResult = UploadOk | UploadFail;

type ApiIssue = { path?: (string | number)[]; message?: string };
type ApiError = { ok?: false; error?: string; issues?: ApiIssue[] };

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function slugifySegment(input: string) {
  return clean(input)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeLastSegment(input: string) {
  // IMPORTANT: this field must be a "segment" only, not "guides/segment"
  const s = clean(input).replace(/\\/g, "/");
  const last = s.split("/").filter(Boolean).pop() ?? "";
  return slugifySegment(last);
}

function buildFullSlug(prefix: string, lastSegment: string) {
  const p = clean(prefix).replace(/^\/+|\/+$/g, "");
  const seg = sanitizeLastSegment(lastSegment);
  if (!p) return seg;
  if (!seg) return p;
  return `${p}/${seg}`;
}

function formatIssues(issues: ApiIssue[] | undefined) {
  if (!Array.isArray(issues) || !issues.length) return null;
  return issues
    .map((i) => {
      const p = Array.isArray(i.path) ? i.path.join(".") : "";
      const m = clean(i.message) || "Invalid";
      return p ? `${p}: ${m}` : m;
    })
    .join(" • ");
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

const CATEGORY_OPTIONS = [
  { value: "guides", label: "guides" },
  { value: "compliance", label: "compliance" },
  { value: "purity-testing", label: "purity-testing" },
  { value: "documentation", label: "documentation" },
  { value: "storage-handling", label: "storage-handling" },
  { value: "buying-guides", label: "buying-guides" },
  { value: "", label: "(no category)" },
] as const;

export default function AdminBlogNew() {
  const router = useRouter();

  // ------------------------
  // Fields
  // ------------------------
  const [title, setTitle] = useState("");

  // You previously used "prefix" as the category slug in the URL.
  // We'll keep that for the URL, AND also send it as `category` to the DB.
  const [category, setCategory] = useState<string>("guides"); // DB category + URL prefix
  const [segment, setSegment] = useState("");
  const [segmentTouched, setSegmentTouched] = useState(false);

  const [excerpt, setExcerpt] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroThumbUrl, setHeroThumbUrl] = useState("");
  const [heroImageAlt, setHeroImageAlt] = useState("");
  const [heroImageWidth, setHeroImageWidth] = useState<number | null>(null);
  const [heroImageHeight, setHeroImageHeight] = useState<number | null>(null);

  const [published, setPublished] = useState(false);

  // ------------------------
  // UI state
  // ------------------------
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSegment = useMemo(() => {
    if (segmentTouched) return sanitizeLastSegment(segment);
    return slugifySegment(title);
  }, [segmentTouched, segment, title]);

  const slugFull = useMemo(() => buildFullSlug(category, effectiveSegment), [category, effectiveSegment]);
  const publicUrl = useMemo(() => `/blog/${slugFull || "…"}`, [slugFull]);

  const readingTime = useMemo(() => {
    const md = clean(contentMarkdown);
    if (md.length < 20) return null;
    return estimateReadingTimeMinutes(md);
  }, [contentMarkdown]);

  function validate(): string | null {
    if (!clean(title)) return "Title is required.";
    if (!clean(slugFull)) return "Slug is required (set a title or slug).";
    if (clean(contentMarkdown).length < 20) return "Content must be at least 20 characters.";
    // if published, encourage excerpt/seo (not required)
    return null;
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setErr(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/admin/blog/upload", {
        method: "POST",
        body: form,
      });

      const json = (await res.json().catch(() => null)) as UploadResult | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        setErr((json as any)?.error || `Upload failed (${res.status})`);
        return;
      }

      const uploaded = json as { ok: true; url: string; thumbUrl?: string; width?: number; height?: number };
      setHeroImageUrl(uploaded.url);
      setHeroThumbUrl(clean(uploaded.thumbUrl) ? String(uploaded.thumbUrl) : "");
      setHeroImageWidth(typeof uploaded.width === "number" ? uploaded.width : null);
      setHeroImageHeight(typeof uploaded.height === "number" ? uploaded.height : null);

      if (!clean(heroImageAlt)) setHeroImageAlt(clean(title) || "Blog hero image");
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function insertMarkdownImage(url: string) {
    const alt = clean(heroImageAlt) || clean(title) || "Image";
    const snippet = `\n\n![${alt}](${url})\n\n`;
    setContentMarkdown((prev) => (prev || "") + snippet);
  }

  function resetHero() {
    setHeroImageUrl("");
    setHeroThumbUrl("");
    setHeroImageWidth(null);
    setHeroImageHeight(null);
  }

  async function onSave() {
    setErr(null);

    const v = validate();
    if (v) return setErr(v);

    setSaving(true);
    try {
      const payload = {
        title: clean(title),

        // Keep your existing behaviour:
        // slug is FULL slug including category prefix (e.g. "guides/what-are-peptides")
        slug: slugFull,

        // New DB field: store category separately too (e.g. "guides")
        // If category is blank, store null
        category: clean(category) ? clean(category) : null,

        excerpt: clean(excerpt) ? clean(excerpt) : null,
        contentMarkdown: String(contentMarkdown ?? ""),

        seoTitle: clean(seoTitle) ? clean(seoTitle) : null,
        seoDescription: clean(seoDescription) ? clean(seoDescription) : null,

        heroImageUrl: clean(heroImageUrl) ? clean(heroImageUrl) : null,
        heroThumbUrl: clean(heroThumbUrl) ? clean(heroThumbUrl) : null,
        heroImageAlt: clean(heroImageAlt) ? clean(heroImageAlt) : null,
        heroImageWidth: typeof heroImageWidth === "number" ? heroImageWidth : null,
        heroImageHeight: typeof heroImageHeight === "number" ? heroImageHeight : null,

        published: Boolean(published),
      };

      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as any;

      if (!res.ok) {
        const issues = formatIssues((json as ApiError)?.issues);
        setErr(clean((json as ApiError)?.error) || issues || "Failed to create post");
        return;
      }

      router.push(`/admin/blog/${json.created.id}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create post");
    } finally {
      setSaving(false);
    }
  }

  // drag/drop
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">New post</h1>
          <div className="mt-1 text-xs text-neutral-500">
            Public URL: <span className="font-mono">{publicUrl}</span>
            {readingTime ? <span className="ml-2">· {readingTime} min read (est.)</span> : null}
          </div>
        </div>
      </div>

      {err ? <p className="mt-4 text-red-600">{err}</p> : null}

      <div className="mt-6 grid gap-4">
        {/* Title */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Title</span>
          <input
            className="rounded-xl border p-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Peptide Purity Explained: Why Labs Report Different Percentages"
          />
        </label>

        {/* URL / Slug */}
        <div className="grid gap-2 rounded-xl border p-4">
          <div className="text-sm font-semibold">URL / Slug</div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Category</span>
              <select
                className="rounded-xl border p-3"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-500">
                URL becomes <span className="font-mono">/blog/{clean(category) || "…"}/…</span>
              </span>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Slug (last segment)</span>
              <input
                className="rounded-xl border p-3 font-mono"
                value={segment}
                onChange={(e) => {
                  setSegmentTouched(true);
                  setSegment(e.target.value);
                }}
                placeholder={slugifySegment(title) || "peptide-purity-explained"}
              />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Tip: leave blank to auto-generate from title.</span>
                <button
                  type="button"
                  className="underline hover:opacity-80"
                  onClick={() => {
                    setSegmentTouched(false);
                    setSegment("");
                  }}
                >
                  Reset to auto
                </button>
              </div>
            </label>
          </div>

          <div className="text-xs text-neutral-500">
            Final slug saved to DB: <span className="font-mono">{slugFull || "…"}</span>
          </div>
        </div>

        {/* Hero image */}
        <div className="grid gap-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Hero image</div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                  e.currentTarget.value = "";
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-black/[0.03] disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload image"}
              </button>
            </div>
          </div>

          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="rounded-2xl border border-dashed border-black/20 bg-black/[0.02] p-5 text-sm text-neutral-600"
          >
            Drag &amp; drop an image here, or click <span className="font-semibold">Upload image</span>.
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Hero image URL</span>
            <input
              className="rounded-xl border p-3 font-mono text-sm"
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              placeholder="e.g. /uploads/blog/abc123.webp"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Hero image alt text</span>
            <input
              className="rounded-xl border p-3"
              value={heroImageAlt}
              onChange={(e) => setHeroImageAlt(e.target.value)}
              placeholder="Describe the image for accessibility + SEO"
            />
          </label>

          {clean(heroImageUrl) ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-neutral-500">
                  Preview
                  {typeof heroImageWidth === "number" && typeof heroImageHeight === "number" ? (
                    <span className="ml-2 font-mono">
                      ({heroImageWidth}×{heroImageHeight})
                    </span>
                  ) : null}
                  {clean(heroThumbUrl) ? <span className="ml-2 opacity-70">· thumb ready</span> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]"
                    onClick={() => insertMarkdownImage(heroImageUrl)}
                  >
                    Insert into Markdown
                  </button>

                  <button
                    type="button"
                    className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]"
                    onClick={resetHero}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-white">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={heroImageUrl}
                    alt={heroImageAlt || title || "Hero image"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 768px"
                    priority
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Excerpt */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Excerpt</span>
          <textarea
            className="rounded-xl border p-3"
            rows={3}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short summary used on the blog list and meta description fallback."
          />
        </label>

        {/* Content */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Content (Markdown)</span>
          <textarea
            className="rounded-xl border p-3 font-mono text-sm"
            rows={16}
            value={contentMarkdown}
            onChange={(e) => setContentMarkdown(e.target.value)}
            placeholder={"# Heading\n\nWrite your post in Markdown…\n\n## OVERVIEW\n### Subheading\n- Bullet"}
          />
          <span className="text-xs text-neutral-500">
            Tip: Use <span className="font-mono">## SECTION</span> + <span className="font-mono">### Subheading</span>.
          </span>
        </label>

        {/* SEO */}
        <div className="grid gap-2 rounded-xl border p-4">
          <div className="text-sm font-semibold">SEO</div>

          <label className="grid gap-1">
            <span className="text-sm">SEO Title (optional)</span>
            <input className="rounded-xl border p-3" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">SEO Description (optional)</span>
            <textarea
              className="rounded-xl border p-3"
              rows={2}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
          </label>
        </div>

        {/* Publish */}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span className="text-sm">Publish immediately</span>
        </label>

        {/* Submit */}
        <button
          onClick={onSave}
          disabled={saving || uploading}
          className="w-fit rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black hover:opacity-95 disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create post"}
        </button>
      </div>
    </main>
  );
}