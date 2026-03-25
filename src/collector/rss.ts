import RssParser from 'rss-parser';
import type { Article, RssSource } from '../types/index.js';

const parser = new RssParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'NewsEngine/1.0',
  },
});

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

async function fetchSingleFeed(
  source: RssSource,
  batchId: string,
  collectedAt: string,
): Promise<Article[]> {
  try {
    console.log(`[Collector:RSS] Fetching ${source.name}...`);
    const feed = await parser.parseURL(source.url);
    const articles: Article[] = (feed.items || []).map((item) => ({
      source: source.name,
      title: (item.title || 'Untitled').trim(),
      url: item.link || item.guid || '',
      published_at: item.isoDate || item.pubDate || null,
      content_snippet: stripHtml(item.contentSnippet || item.content || item.summary),
      language: source.language,
      collected_at: collectedAt,
      batch_id: batchId,
    }));

    // Filter out articles without URL
    const valid = articles.filter((a) => a.url.length > 0);
    console.log(`[Collector:RSS] ${source.name}: ${valid.length} articles collected`);
    return valid;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Collector:RSS] Failed to fetch ${source.name}: ${message}`);
    return [];
  }
}

export async function collectFromRss(
  sources: RssSource[],
  batchId: string,
): Promise<Article[]> {
  const collectedAt = new Date().toISOString();
  const results = await Promise.allSettled(
    sources.map((source) => fetchSingleFeed(source, batchId, collectedAt)),
  );

  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }

  console.log(`[Collector:RSS] Total from RSS: ${articles.length} articles`);
  return articles;
}
