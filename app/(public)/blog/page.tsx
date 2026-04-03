// app/(public)/blog/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { absUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const TITLE = "Research Articles | Signal Labs";
const DESC =
  "Research articles covering analytical testing, verification standards, and laboratory documentation. Research use only.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: absUrl("/blog") },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: absUrl("/blog"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
};

type IndexPost = {
  id: string;
  title: string;
  href: string;
  excerpt: string;
  dateLabel: string;
  isStatic?: boolean;
};

function formatDate(d: Date | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Static "seed" posts that exist as App Router pages
 * (lets you publish authority content before the DB workflow is ready).
 */
const STATIC_POSTS: IndexPost[] = [
  {
    id: "static-what-are-research-peptides-uk",
    title: "What Are Research Peptides? A UK Scientific Guide",
    href: "/blog/guides/what-are-research-peptides-uk",
    excerpt:
      "A detailed UK guide covering what research peptides are, how they’re studied, purity standards, COAs, storage, and Research-Use-Only.",
    dateLabel: "Evergreen",
    isStatic: true,
  },
];

export default async function BlogIndexPage() {
  const dbPosts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const normalizedDb: IndexPost[] = dbPosts.map((p) => ({
    id: `db-${p.id}`,
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt ?? "",
    dateLabel: formatDate(p.publishedAt ?? p.updatedAt ?? p.createdAt),
  }));

  // Dedup by href (in case you later store the same slug in DB)
  const seen = new Set<string>();
  const merged: IndexPost[] = [];

  for (const p of [...STATIC_POSTS, ...normalizedDb]) {
    const key = p.href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight text-[#0B1220]">
          Research Articles
        </h1>
        <p className="mt-3 text-sm text-[#0B1220]/70">
          Educational content and verification standards. Research use only.
        </p>

        <div className="mt-8">
          {merged.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-[#0B1220]/70">
              No articles published yet.
            </div>
          ) : (
            <div className="space-y-5">
              {merged.map((p) => (
                <article
                  key={p.id}
                  className="rounded-2xl border border-black/10 bg-white p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-semibold text-[#0B1220]">
                      <Link className="hover:underline" href={p.href}>
                        {p.title}
                      </Link>
                      {p.isStatic ? (
                        <span className="ml-2 rounded-full border border-black/10 bg-black/[0.02] px-2 py-0.5 align-middle text-[11px] font-semibold text-[#0B1220]/70">
                          Pillar
                        </span>
                      ) : null}
                    </h2>

                    <div className="shrink-0 text-xs text-[#0B1220]/60">
                      {p.dateLabel}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-[#0B1220]/75">{p.excerpt}</p>

                  <div className="mt-4">
                    <Link
                      href={p.href}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1220] hover:opacity-80"
                    >
                      Read more <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 text-xs text-[#0B1220]/55">
          All products sold by Signal Labs are supplied strictly for laboratory and analytical
          research purposes only. Not for human or veterinary consumption. Not intended to diagnose,
          treat, cure, or prevent any disease.
        </div>
      </div>
    </main>
  );
}