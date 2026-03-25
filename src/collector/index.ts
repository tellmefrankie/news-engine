import { collectFromRss } from './rss.js';
import { collectFromNaver } from './naver.js';
import { RSS_SOURCES, NAVER_CONFIG } from '../config/sources.js';
import { insertArticle } from '../db/index.js';
import type { Article } from '../types/index.js';

export async function collect(batchId: string): Promise<number> {
  console.log(`[Collector] Starting collection for batch: ${batchId}`);

  const maxBatchSize = parseInt(process.env.NEWS_BATCH_SIZE || '50', 10);

  // Collect from all sources in parallel
  const [rssArticles, naverArticles] = await Promise.all([
    collectFromRss(RSS_SOURCES, batchId),
    collectFromNaver(NAVER_CONFIG, batchId),
  ]);

  // Merge and deduplicate by URL
  const allArticles: Article[] = [...rssArticles, ...naverArticles];
  const seenUrls = new Set<string>();
  const deduplicated: Article[] = [];

  for (const article of allArticles) {
    if (!seenUrls.has(article.url)) {
      seenUrls.add(article.url);
      deduplicated.push(article);
    }
  }

  console.log(`[Collector] After dedup: ${deduplicated.length} unique articles (from ${allArticles.length} total)`);

  // Limit to batch size
  const toInsert = deduplicated.slice(0, maxBatchSize);

  // Insert into DB
  let inserted = 0;
  for (const article of toInsert) {
    const id = insertArticle(article);
    if (id !== null) {
      inserted++;
    }
  }

  console.log(`[Collector] Inserted ${inserted} new articles into DB (${toInsert.length - inserted} duplicates skipped)`);
  return inserted;
}
