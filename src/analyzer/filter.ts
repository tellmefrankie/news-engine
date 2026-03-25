import Anthropic from '@anthropic-ai/sdk';
import { FILTER_PROMPT } from '../config/prompts.js';
import type { ArticleRow } from '../types/index.js';

function buildArticleList(articles: ArticleRow[]): string {
  return articles
    .map((a, i) => `[${i}] ${a.title} (${a.source}) — ${a.content_snippet?.slice(0, 100) || 'No snippet'}`)
    .join('\n');
}

export async function filterTopArticles(
  client: Anthropic,
  articles: ArticleRow[],
  topN: number,
): Promise<ArticleRow[]> {
  if (articles.length <= topN) {
    console.log(`[Analyzer:Filter] Only ${articles.length} articles, returning all`);
    return articles;
  }

  const articleList = buildArticleList(articles);
  const userMessage = `${FILTER_PROMPT}\n\n뉴스 목록 (${articles.length}건):\n${articleList}`;

  console.log(`[Analyzer:Filter] Requesting Claude to select top ${topN} from ${articles.length} articles...`);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Parse JSON array from response
      const jsonMatch = text.match(/\[[\d\s,]+\]/);
      if (!jsonMatch) {
        throw new Error(`Could not parse JSON array from response: ${text.slice(0, 200)}`);
      }

      const indices = JSON.parse(jsonMatch[0]) as number[];
      const validIndices = indices
        .filter((i) => typeof i === 'number' && i >= 0 && i < articles.length)
        .slice(0, topN);

      if (validIndices.length === 0) {
        throw new Error('No valid indices returned');
      }

      const selected = validIndices.map((i) => articles[i]);
      console.log(`[Analyzer:Filter] Selected ${selected.length} articles: ${selected.map((a) => a.title.slice(0, 40)).join(', ')}`);
      return selected;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Analyzer:Filter] Attempt ${attempt}/3 failed: ${lastError.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  console.error(`[Analyzer:Filter] All attempts failed. Falling back to first ${topN} articles.`);
  return articles.slice(0, topN);
}
