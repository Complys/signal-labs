-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN "category" TEXT DEFAULT 'guides';
ALTER TABLE "BlogPost" ADD COLUMN "heroImageHeight" INTEGER;
ALTER TABLE "BlogPost" ADD COLUMN "heroImageWidth" INTEGER;
ALTER TABLE "BlogPost" ADD COLUMN "heroThumbUrl" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "readingTimeMins" INTEGER;
ALTER TABLE "BlogPost" ADD COLUMN "tocJson" TEXT;

-- CreateIndex
CREATE INDEX "BlogPost_category_published_publishedAt_idx" ON "BlogPost"("category", "published", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_slug_published_idx" ON "BlogPost"("slug", "published");
