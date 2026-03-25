import Anthropic from '@anthropic-ai/sdk';
import { filterTopArticles } from './filter.js';
import { analyzeArticle } from './analyze.js';
import { getUnanalyzedArticles, insertAnalysis } from '../db/index.js';
import type { Analysis } from '../types/index.js';

export async function analyze(batchId: string): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[Analyzer] ANTHROPIC_API_KEY not set. Skipping analysis.');
    return 0;
  }

  const client = new Anthropic({ apiKey });
  const topN = parseInt(process.env.NEWS_TOP_N || '5', 10);

  // Get unanalyzed articles for this batch
  const articles = getUnanalyzedArticles(batchId);
  if (articles.length === 0) {
    console.log('[Analyzer] No unanalyzed articles found for this batch.');
    return 0;
  }

  console.log(`[Analyzer] Found ${articles.length} unanalyzed articles. Filtering top ${topN}...`);

  // Step 1: Filter top N articles
  const topArticles = await filterTopArticles(client, articles, topN);

  // Step 2: Analyze each article
  let analyzedCount = 0;
  for (let i = 0; i < topArticles.length; i++) {
    const article = topArticles[i];
    console.log(`[Analyzer] Analyzing ${i + 1}/${topArticles.length}: "${article.title.slice(0, 50)}..."`);

    const result = await analyzeArticle(client, article);
    const now = new Date().toISOString();

    const analysis: Omit<Analysis, 'id'> = {
      article_id: article.id,
      batch_id: batchId,
      rank: i + 1,
      summary_ko: result.summary_ko,
      industry_tags: result.industry_tags,
      sentiment: result.sentiment,
      impact_score: result.impact_score,
      commentary: result.commentary,
      analyzed_at: now,
      published_to_telegram: 0,
    };

    insertAnalysis(analysis);
    analyzedCount++;

    // Small delay between API calls to be polite
    if (i < topArticles.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[Analyzer] Analysis complete: ${analyzedCount} articles analyzed and saved.`);
  return analyzedCount;
}
