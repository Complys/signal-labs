import Image from "next/image";
import Link from "next/link";
import React from "react";
import Markdown from "@/app/_components/blog/Markdown"; // your markdown renderer (or we add one)

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default function BlogPostView({ post }: { post: any }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* Breadcrumbs */}
      <nav className="text-sm text-white/60 mb-6">
        <Link href="/blog" className="hover:underline">Research Articles</Link>
        <span className="mx-2">/</span>
        <span className="text-white/80">{post.title}</span>
      </nav>

      {/* Hero */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {post.title}
        </h1>

        <div className="mt-3 text-sm text-white/60 flex items-center gap-3">
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
          {post.readingTimeMins ? <span>• {post.readingTimeMins} min read</span> : null}
          <span>• Research use only</span>
        </div>

        {post.excerpt ? (
          <p className="mt-4 text-white/75 text-lg leading-relaxed">
            {post.excerpt}
          </p>
        ) : null}

        {post.heroImageUrl ? (
          <div className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="relative aspect-[16/9]">
              <Image
                src={post.heroImageUrl}
                alt={post.heroImageAlt || post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        ) : null}
      </header>

      {/* Article */}
      <article className="prose prose-invert max-w-none prose-headings:scroll-mt-24">
        <Markdown content={post.content} />
      </article>

      {/* Footer disclaimer */}
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
        <strong className="text-white/85">Disclaimer:</strong> Products are supplied strictly for laboratory and analytical research purposes only. Not for human or veterinary consumption. Not intended to diagnose, treat, cure, or prevent any disease.
      </div>
    </main>
  );
}