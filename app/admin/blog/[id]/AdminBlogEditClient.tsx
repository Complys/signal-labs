"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

type UploadResult = { ok: true; url: string } | { ok?: false; error?: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^-+|-+$/g, "");
}

export default function AdminBlogEditClient({ id }: { id: string }) {
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [published, setPublished] = useState(false);

  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImageAlt, setHeroImageAlt] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const publicUrl = useMemo(() => `/blog/${slug || slugify(title)}`, [slug, title]);

  async function load() {
    setLoading(true);
    setErr(null);

    const res = await fetch(`/api/admin/blog/${id}`, { cache: "no-store" });
    const json = await res.json();

    if (!res.ok) {
      setErr(json?.error || "Failed to load");
      setLoading(false);
      return;
    }

    const p: Post = json.post;
    setPost(p);

    setTitle(p.title);
    setSlug(p.slug);
    setExcerpt(p.excerpt || "");
    setContentMarkdown(p.contentMarkdown || "");
    setSeoTitle(p.seoTitle ?? "");
    setSeoDescription(p.seoDescription ?? "");
    setPublished(Boolean(p.published));

    setHeroImageUrl(p.heroImageUrl ?? "");
    setHeroImageAlt(p.heroImageAlt ?? "");

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function uploadFile(file: File) {
    setUploading(true);
    setErr(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/admin/blog/upload", { method: "POST", body: form });
      const json = (await res.json()) as UploadResult;

      if (!res.ok || !json || (json as any).ok !== true) {
        setErr((json as any)?.error || "Upload failed");
        return;
      }

      const uploaded = json as { ok: true; url: string; thumbUrl?: string; width?: number; height?: number };
      setHeroImageUrl(uploaded.url);
      if (!heroImageAlt) setHeroImageAlt(title || file.name);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setErr(null);

    const res = await fetch(`/api/admin/blog/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug || slugify(title),
        excerpt,
        contentMarkdown,
        seoTitle: seoTitle ? seoTitle : null,
        seoDescription: seoDescription ? seoDescription : null,
        heroImageUrl: heroImageUrl ? heroImageUrl : null,
        heroImageAlt: heroImageAlt ? heroImageAlt : null,
        published,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || "Failed to save");
      setSaving(false);
      return;
    }

    setPost(json.post);
    setSaving(false);
  }

  async function onDelete() {
    const ok = confirm("Delete this post? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    setErr(null);

    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) {
      setErr(json?.error || "Failed to delete");
      setDeleting(false);
      return;
    }

    router.push("/admin/blog");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Edit post</h1>
          <div className="mt-1 text-sm text-neutral-500">
            Public URL: <span className="font-mono">{publicUrl}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            disabled={deleting || loading}
            className="rounded-full border px-5 py-3 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>

          <button
            onClick={onSave}
            disabled={saving || loading}
            className="rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-black hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {loading ? <p className="mt-6 text-neutral-600">Loading…</p> : null}
      {err ? <p className="mt-6 text-red-600">{err}</p> : null}

      {!loading && post ? (
        <div className="mt-8 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Title</span>
            <input
              className="rounded-xl border p-3"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Slug</span>
            <input
              className="rounded-xl border p-3 font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <span className="text-xs text-neutral-500">
              Tip: you can use nested slugs like <span className="font-mono">guides/peptide-purity-explained</span>
            </span>
          </label>

          {/* HERO IMAGE */}
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
                {heroImageUrl ? (
                  <button
                    type="button"
                    className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]"
                    onClick={() => {
                      setHeroImageUrl("");
                      setHeroImageAlt("");
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Hero image URL</span>
              <input
                className="rounded-xl border p-3 font-mono text-sm"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder="/uploads/blog/123-hero.jpg"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Hero image alt text</span>
              <input
                className="rounded-xl border p-3"
                value={heroImageAlt}
                onChange={(e) => setHeroImageAlt(e.target.value)}
                placeholder="Describe the image for accessibility"
              />
            </label>

            {heroImageUrl ? (
              <div className="overflow-hidden rounded-2xl border bg-white">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={heroImageUrl}
                    alt={heroImageAlt || title || "Hero image"}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Excerpt</span>
            <textarea
              className="rounded-xl border p-3"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Content (Markdown)</span>
            <textarea
              className="rounded-xl border p-3 font-mono text-sm"
              rows={16}
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
            />
          </label>

          <div className="grid gap-2 rounded-xl border p-4">
            <div className="text-sm font-semibold">SEO</div>
            <label className="grid gap-1">
              <span className="text-sm">SEO Title (optional)</span>
              <input
                className="rounded-xl border p-3"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
              />
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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span className="text-sm">Published</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/blog")}
              className="rounded-full border px-6 py-3 text-sm font-semibold hover:bg-neutral-50"
            >
              Back to list
            </button>

            <button
              onClick={onSave}
              disabled={saving}
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