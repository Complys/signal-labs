// app/(public)/blog/[...slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { prisma } from "@/lib/prisma";
import { absUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type PageProps = {
  // Next.js 15/16: params is async
  params: Promise<{ slug: string[] }>;
};

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function joinSlug(parts: string[] | undefined) {
  if (!parts?.length) return "";
  return parts.map((p) => clean(p)).filter(Boolean).join("/");
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

async function getPostBySlug(slug: string) {
  const safeSlug = clean(slug);
  if (!safeSlug) return null;

  return prisma.blogPost.findFirst({
    where: { slug: safeSlug, published: true },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentMarkdown: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,

      // ✅ include hero fields so they can render
      heroImageUrl: true,
      heroImageAlt: true,
    },
  });
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const slug = joinSlug(params.slug);

  if (!slug) return { robots: { index: false, follow: false } };

  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      robots: { index: false, follow: false },
      title: "Not found",
    };
  }

  const title = clean(post.seoTitle) || post.title;
  const description = clean(post.seoDescription) || clean(post.excerpt);
  const canonical = absUrl(`/blog/${post.slug}`);

  const heroAbs = post.heroImageUrl ? absUrl(post.heroImageUrl) : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images: heroAbs ? [{ url: heroAbs }] : undefined,
    },
    twitter: {
      card: heroAbs ? "summary_large_image" : "summary",
      title,
      description,
      images: heroAbs ? [heroAbs] : undefined,
    },
  };
}

export default async function BlogPostPage(props: PageProps) {
  const params = await props.params;
  const slug = joinSlug(params.slug);

  if (!slug) return notFound();

  const post = await getPostBySlug(slug);
  if (!post) return notFound();

  const title = clean(post.seoTitle) || post.title;
  const description = clean(post.seoDescription) || clean(post.excerpt);

  const canonical = absUrl(`/blog/${post.slug}`);
  const publishedDate = post.publishedAt ?? post.createdAt;
  const modifiedDate = post.updatedAt ?? post.createdAt;

  const related = await prisma.blogPost.findMany({
    where: { published: true, slug: { not: post.slug } },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      heroImageUrl: true,
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    headline: title,
    description,
    datePublished: publishedDate.toISOString(),
    dateModified: modifiedDate.toISOString(),
    author: { "@type": "Organization", name: "Signal Labs", url: absUrl("/") },
    publisher: { "@type": "Organization", name: "Signal Labs", url: absUrl("/") },
    image: post.heroImageUrl ? [absUrl(post.heroImageUrl)] : undefined,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: "Blog", item: absUrl("/blog") },
      { "@type": "ListItem", position: 3, name: title, item: canonical },
    ],
  };

  const heroUrl = clean(post.heroImageUrl);
  const heroAlt = clean(post.heroImageAlt) || title;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/blog"
          className="text-sm font-semibold text-[#0B1220] hover:underline"
        >
          ← Back to Research Articles
        </Link>
      </div>

      <article className="rounded-2xl border border-black/10 bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#0B1220]/60">
          <span>{formatDate(publishedDate)}</span>
          <span>•</span>
          <span>Updated {formatDate(modifiedDate)}</span>

          <span className="ml-auto inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-semibold text-[#0B1220]">
            Research use only
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0B1220]">
          {title}
        </h1>

        {post.excerpt ? (
          <p className="mt-4 text-base leading-relaxed text-[#0B1220]/75">
            {post.excerpt}
          </p>
        ) : null}

        {/* ✅ Hero image (renders the uploaded URL from admin) */}
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt={heroAlt}
            className="mt-8 w-full rounded-2xl border border-black/10"
          />
        ) : null}

        <div className="prose prose-lg max-w-none prose-headings:text-[#0B1220] prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-[#0B1220]/80 prose-p:leading-7 prose-li:text-[#0B1220]/80 prose-strong:text-[#0B1220] prose-a:text-[#0B1220] prose-a:underline prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-xl prose-h3:mt-8 prose-ul:my-4 prose-ol:my-4 prose-li:my-1">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
            components={{
              img: ({ ...props }) => {
                const src = String(props.src || "");
                const alt = String(props.alt || "");
                // eslint-disable-next-line @next/next/no-img-element
                return (
                  <img
                    {...props}
                    alt={alt}
                    src={src}
                    className="my-6 w-full rounded-2xl border border-black/10"
                  />
                );
              },
              a: ({ href, children }) => {
                const h = String(href || "");
                const isExternal = h.startsWith("http");
                return (
                  <a
                    href={h}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {post.contentMarkdown ?? ""}
          </ReactMarkdown>
        </div>

        <div className="mt-10 rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-xs text-black/60">
          <strong className="text-black/70">Disclaimer:</strong> Research use only.
          Not for human or veterinary use. Not intended to diagnose, treat, cure, or
          prevent disease.
        </div>
      </article>

      {related.length ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-[#0B1220]">More articles</h2>
          <div className="mt-3 space-y-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/blog/${r.slug}`}
                className="block rounded-2xl border border-black/10 bg-white p-4 hover:bg-black/[0.02]"
              >
                <div className="flex items-start gap-3">
                  {r.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.heroImageUrl}
                      alt=""
                      className="h-12 w-12 flex-none rounded-xl border border-black/10 object-cover"
                    />
                  ) : null}

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#0B1220]">
                      {r.title}
                    </div>
                    {r.excerpt ? (
                      <div className="mt-1 text-xs text-[#0B1220]/70">
                        {r.excerpt}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}