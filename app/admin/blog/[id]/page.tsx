// app/admin/blog/[id]/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type TocItem = { level: number; text: string; id: string };

type Post = {
  id: string;
  title: string;
  slug: string;

  excerpt: string | null;
  contentMarkdown: string;

  // new fields (optional until migration + backfill)
  category?: string | null;
  readingTimeMins?: number | null;
  tocJson?: string | null;

  seoTitle: string | null;
  seoDescription: string | null;

  heroImageUrl?: string | null;
  heroThumbUrl?: string | null;
  heroImageAlt?: string | null;
  heroImageWidth?: number | null;
  heroImageHeight?: number | null;

  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

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

function splitFullSlug(full: string) {
  const s = clean(full).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length <= 1) return { prefix: "guides", segment: parts[0] ?? "" };
  const prefix = parts[0];
  const segment = parts.slice(1).join("/");
  return { prefix, segment };
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

function safeParseToc(json: unknown): TocItem[] {
  try {
    const s = clean(json);
    if (!s) return [];
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        level: Number((x as any)?.level),
        text: String((x as any)?.text ?? ""),
        id: String((x as any)?.id ?? ""),
      }))
      .filter((x) => x.level >= 2 && x.level <= 6 && x.text && x.id);
  } catch {
    return [];
  }
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

export default function AdminBlogEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = clean(params?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // form
  const [title, setTitle] = useState("");

  // DB category (also used as URL prefix)
  const [category, setCategory] = useState<string>("guides");

  // slug segment
  const [segment, setSegment] = useState("");
  const [segmentTouched, setSegmentTouched] = useState(false);

  const [excerpt, setExcerpt] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [published, setPublished] = useState(false);

  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroThumbUrl, setHeroThumbUrl] = useState("");
  const [heroImageAlt, setHeroImageAlt] = useState("");
  const [heroImageWidth, setHeroImageWidth] = useState<number | null>(null);
  const [heroImageHeight, setHeroImageHeight] = useState<number | null>(null);

  // read-only meta from DB (nice to display)
  const [readingTimeMins, setReadingTimeMins] = useState<number | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSegment = useMemo(() => {
    if (segmentTouched) return sanitizeLastSegment(segment);
    return slugifySegment(title) || sanitizeLastSegment(segment);
  }, [segmentTouched, segment, title]);

  const slugFull = useMemo(() => buildFullSlug(category, effectiveSegment), [category, effectiveSegment]);
  const publicUrl = useMemo(() => `/blog/${slugFull || "…"}`, [slugFull]);

  async function load() {
    if (!id) return;

    setLoading(true);
    setErr(null);
    setSavedMsg(null);

    try {
      const res = await fetch(`/api/admin/blog/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.post) {
        setErr(json?.error || "Failed to load post");
        setLoading(false);
        return;
      }

      const p: Post = json.post;

      setTitle(p.title || "");

      // prefer DB category; fallback to first segment of slug
      const sp = splitFullSlug(p.slug || "");
      const dbCat = clean(p.category);
      const inferredCat = clean(sp.prefix);
      setCategory(dbCat || inferredCat || "guides");

      setSegment(sp.segment || "");
      setSegmentTouched(true);

      setExcerpt(p.excerpt ?? "");
      setContentMarkdown(p.contentMarkdown || "");
      setSeoTitle(p.seoTitle ?? "");
      setSeoDescription(p.seoDescription ?? "");
      setPublished(Boolean(p.published));

      setHeroImageUrl(p.heroImageUrl ?? "");
      setHeroThumbUrl((p as any).heroThumbUrl ?? "");
      setHeroImageAlt(p.heroImageAlt ?? "");
      setHeroImageWidth(typeof (p as any).heroImageWidth === "number" ? (p as any).heroImageWidth : null);
      setHeroImageHeight(typeof (p as any).heroImageHeight === "number" ? (p as any).heroImageHeight : null);

      setReadingTimeMins(typeof (p as any).readingTimeMins === "number" ? (p as any).readingTimeMins : null);
      setToc(safeParseToc((p as any).tocJson));

      setLoading(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to load post");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function validate(): string | null {
    if (!clean(title)) return "Title is required.";
    if (!clean(slugFull)) return "Slug is required.";
    if (clean(contentMarkdown).length < 20) return "Content must be at least 20 characters.";
    return null;
  }

  async function onSave() {
    if (!id) return;

    setSavedMsg(null);
    setErr(null);

    const v = validate();
    if (v) return setErr(v);

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: clean(title),
          slug: slugFull,

          // ✅ store category separately
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
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const issues = formatIssues((json as ApiError)?.issues);
        setErr(clean((json as ApiError)?.error) || issues || "Failed to save post");
        return;
      }

      // Update meta from server response (reading time + TOC might change after save)
      const post: Post | undefined = (json as any)?.post;
      if (post) {
        setReadingTimeMins(typeof (post as any).readingTimeMins === "number" ? (post as any).readingTimeMins : readingTimeMins);
        setToc(safeParseToc((post as any).tocJson));
      }

      setSavedMsg("Saved.");
    } catch (e: any) {
      setErr(e?.message || "Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    const ok = confirm("Delete this blog post? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    setErr(null);
    setSavedMsg(null);

    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(json?.error || "Failed to delete post");
        return;
      }
      router.push("/admin/blog");
    } catch (e: any) {
      setErr(e?.message || "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setErr(null);
    setSavedMsg(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/admin/blog/upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as UploadResult | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        setErr((json as any)?.error || "Upload failed");
        return;
      }

      const uploaded = json as { ok: true; url: string; thumbUrl?: string; width?: number; height?: number };
      setHeroImageUrl(uploaded.url);
      setHeroThumbUrl(clean(uploaded.thumbUrl) ? String(uploaded.thumbUrl) : "");
      setHeroImageWidth(typeof uploaded.width === "number" ? uploaded.width : null);
      setHeroImageHeight(typeof uploaded.height === "number" ? uploaded.height : null);

      if (!clean(heroImageAlt)) setHeroImageAlt(clean(title) || file.name);
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Edit post</h1>
          <div className="mt-1 text-sm text-neutral-500">
            Public URL: <span className="font-mono">{publicUrl}</span>
            {typeof readingTimeMins === "number" && readingTimeMins > 0 ? (
              <span className="ml-2">· {readingTimeMins} min read</span>
            ) : null}
          </div>
          {savedMsg ? <div className="mt-1 text-sm text-green-600">{savedMsg}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            disabled={deleting || loading || !id}
            className="rounded-full border px-5 py-3 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>

          <button
            onClick={onSave}
            disabled={saving || loading || !id}
            className="rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {!id ? <p className="mt-6 text-red-600">Missing post id in route.</p> : null}
      {loading ? <p className="mt-6 text-neutral-600">Loading…</p> : null}
      {err ? <p className="mt-6 text-red-600">{err}</p> : null}

      {!loading ? (
        <div className="mt-8 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Title</span>
            <input className="rounded-xl border p-3" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          {/* URL / Slug */}
          <div className="grid gap-2 rounded-xl border p-4">
            <div className="text-sm font-semibold">URL / Slug</div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium">Category</span>
                <select className="rounded-xl border p-3" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-neutral-500">
                  URL: <span className="font-mono">/blog/{clean(category) || "…"}/…</span>
                </div>
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
                <div className="text-xs text-neutral-500">
                  Final slug saved to DB: <span className="font-mono">{slugFull || "…"}</span>
                </div>
              </label>
            </div>
          </div>

          {/* TOC Preview (optional but handy) */}
          {toc.length ? (
            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold">Table of contents (auto)</div>
              <div className="mt-2 space-y-1 text-sm text-neutral-700">
                {toc.slice(0, 12).map((t) => (
                  <div key={t.id} className={t.level === 2 ? "" : t.level === 3 ? "ml-4" : "ml-8"}>
                    • {t.text}
                  </div>
                ))}
                {toc.length > 12 ? <div className="text-xs text-neutral-500">…and {toc.length - 12} more</div> : null}
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                TOC updates when you save (generated from your ## / ### headings).
              </div>
            </div>
          ) : null}

          {/* HERO IMAGE */}
          <div className="grid gap-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Hero image</div>

              <div className="flex flex-wrap items-center gap-2">
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

                {heroImageUrl ? (
                  <>
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
                  </>
                ) : null}
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Hero image URL</span>
              <input className="rounded-xl border p-3 font-mono text-sm" value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Hero image alt text</span>
              <input className="rounded-xl border p-3" value={heroImageAlt} onChange={(e) => setHeroImageAlt(e.target.value)} />
            </label>

            {heroImageUrl ? (
              <div className="grid gap-2">
                <div className="text-xs text-neutral-500">
                  {typeof heroImageWidth === "number" && typeof heroImageHeight === "number" ? (
                    <span className="font-mono">
                      ({heroImageWidth}×{heroImageHeight})
                    </span>
                  ) : (
                    <span>Preview</span>
                  )}
                  {clean(heroThumbUrl) ? <span className="ml-2 opacity-70">· thumb saved</span> : null}
                </div>

                <div className="overflow-hidden rounded-2xl border bg-white">
                  <div className="relative aspect-[16/9]">
                    <Image
                      src={heroImageUrl}
                      alt={heroImageAlt || title || "Hero image"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 768px"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Excerpt</span>
            <textarea className="rounded-xl border p-3" rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Content (Markdown)</span>
            <textarea
              className="rounded-xl border p-3 font-mono text-sm"
              rows={16}
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
            />
            <div className="text-xs text-neutral-500">
              Tip: Use <span className="font-mono">## SECTION</span> and <span className="font-mono">### Subheading</span>.
            </div>
          </label>

          <div className="grid gap-2 rounded-xl border p-4">
            <div className="text-sm font-semibold">SEO</div>
            <label className="grid gap-1">
              <span className="text-sm">SEO Title (optional)</span>
              <input className="rounded-xl border p-3" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm">SEO Description (optional)</span>
              <textarea className="rounded-xl border p-3" rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span className="text-sm">Published</span>
          </label>

          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin/blog")} className="rounded-full border px-6 py-3 text-sm font-semibold hover:bg-neutral-50">
              Back to list
            </button>

            <button
              onClick={onSave}
              disabled={saving || !id}
              className="rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black hover:opacity-95 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}