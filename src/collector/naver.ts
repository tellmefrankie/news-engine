import type { Article, NaverSearchConfig } from '../types/index.js';

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverNewsResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}

function stripHtml(html: string): string {
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

async function searchNaver(
  keyword: string,
  config: NaverSearchConfig,
  clientId: string,
  clientSecret: string,
): Promise<NaverNewsItem[]> {
  const url = new URL('https://openapi.naver.com/v1/search/news.json');
  url.searchParams.set('query', keyword);
  url.searchParams.set('display', String(config.display));
  url.searchParams.set('sort', config.sort);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as NaverNewsResponse;
    return data.items || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Collector:Naver] Search failed for "${keyword}": ${message}`);
    return [];
  }
}

export async function collectFromNaver(
  config: NaverSearchConfig,
  batchId: string,
): Promise<Article[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Collector:Naver] NAVER_CLIENT_ID or NAVER_CLIENT_SECRET not set. Skipping Naver collection.');
    return [];
  }

  const collectedAt = new Date().toISOString();
  const allItems: NaverNewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const keyword of config.keywords) {
    console.log(`[Collector:Naver] Searching for "${keyword}"...`);
    const items = await searchNaver(keyword, config, clientId, clientSecret);
    for (const item of items) {
      const url = item.originallink || item.link;
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allItems.push(item);
      }
    }
  }

  const articles: Article[] = allItems.map((item) => ({
    source: 'naver',
    title: stripHtml(item.title),
    url: item.originallink || item.link,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    content_snippet: stripHtml(item.description),
    language: 'ko' as const,
    collected_at: collectedAt,
    batch_id: batchId,
  }));

  console.log(`[Collector:Naver] Total from Naver: ${articles.length} articles`);
  return articles;
}
