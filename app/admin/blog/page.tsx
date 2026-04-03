"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;

  category?: string | null;

  heroImageUrl?: string | null;
  heroThumbUrl?: string | null;

  readingTimeMins?: number | null;
};

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Filter = "ALL" | "PUBLISHED" | "DRAFT";

export default function AdminBlogList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const published = rows.filter((r) => r.published).length;
    const draft = rows.length - published;
    return { total: rows.length, published, draft };
  }, [rows]);

  const load = useCallback(async () => {
    const ac = new AbortController();
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/blog", { cache: "no-store", signal: ac.signal });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(clean(json?.error) || "Failed to load blog posts");
        setRows([]);
        setLoading(false);
        return () => ac.abort();
      }

      setRows(Array.isArray(json?.posts) ? json.posts : []);
      setLoading(false);
    } catch (e: any) {
      if (e?.name === "AbortError") return () => ac.abort();
      setErr("Network error loading blog posts");
      setRows([]);
      setLoading(false);
    }

    return () => ac.abort();
  }, []);

  useEffect(() => {
    let cleanup: void | (() => void);
    (async () => {
      cleanup = await load();
    })();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [load]);

  const filtered = useMemo(() => {
    const needle = clean(q).toLowerCase();

    return rows
      .filter((r) => {
        if (filter === "PUBLISHED") return r.published;
        if (filter === "DRAFT") return !r.published;
        return true;
      })
      .filter((r) => {
        if (!needle) return true;
        const hay = `${r.title} ${r.slug} ${r.excerpt ?? ""} ${r.category ?? ""}`.toLowerCase();
        return hay.includes(needle);
      });
  }, [rows, filter, q]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog</h1>
          <p className="mt-1 text-sm text-white/70">
            Total: <span className="font-semibold text-white">{counts.total}</span> • Published:{" "}
            <span className="font-semibold text-white">{counts.published}</span> • Drafts:{" "}
            <span className="font-semibold text-white">{counts.draft}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Refresh
          </button>

          <Link
            href="/admin/blog/new"
            className="rounded-full bg-yellow-400 px-5 py-2 text-sm font-semibold text-black hover:opacity-95"
          >
            New post
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex overflow-hidden rounded-full border border-white/15 bg-white/5 text-sm">
          {(["ALL", "PUBLISHED", "DRAFT"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-4 py-2 font-semibold ${
                filter === k ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
              }`}
            >
              {k === "ALL" ? "All" : k === "PUBLISHED" ? "Published" : "Drafts"}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title / slug / category…"
          className="w-full sm:w-80 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none"
        />
      </div>

      {loading ? <p className="mt-6 text-sm text-white/70">Loading…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-400">{err}</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03] text-left">
            <tr>
              <th className="p-3">Post</th>
              <th className="p-3">URL</th>
              <th className="p-3">Status</th>
              <th className="p-3">Published</th>
              <th className="p-3">Updated</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading && !filtered.length ? (
              <tr className="border-t">
                <td className="p-4 text-neutral-600" colSpan={6}>
                  No matching posts.
                </td>
              </tr>
            ) : null}

            {filtered.map((r) => {
              const publicHref = `/blog/${r.slug}`;
              const editHref = `/admin/blog/${r.id}`;
              const thumb = clean(r.heroThumbUrl) || clean(r.heroImageUrl);

              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-start gap-3">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-10 w-10 flex-none rounded-xl border border-black/10 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-10 flex-none rounded-xl border border-black/10 bg-black/[0.03]" />
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link className="font-semibold hover:underline" href={editHref}>
                            {r.title}
                          </Link>

                          {clean(r.category) ? (
                            <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] font-semibold text-neutral-700">
                              {r.category}
                            </span>
                          ) : null}

                          {typeof r.readingTimeMins === "number" && r.readingTimeMins > 0 ? (
                            <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] font-semibold text-neutral-700">
                              {r.readingTimeMins} min
                            </span>
                          ) : null}
                        </div>

                        {r.excerpt ? (
                          <div className="mt-1 line-clamp-1 text-xs text-neutral-600">{r.excerpt}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-neutral-600">
                    <code className="rounded bg-black/[0.03] px-2 py-1 text-xs">{publicHref}</code>
                  </td>

                  <td className="p-3">
                    {r.published ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                        Draft
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-neutral-600">{fmtDateTime(r.publishedAt)}</td>
                  <td className="p-3 text-neutral-600">{fmtDateTime(r.updatedAt)}</td>

                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={editHref}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-black/[0.03]"
                      >
                        Edit
                      </Link>

                      <a
                        href={publicHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-black/[0.03]"
                      >
                        View
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-white/50">
        Tip: Upload hero images to keep social previews (OpenGraph/Twitter) looking clean.
      </p>
    </main>
  );
}