import Anthropic from '@anthropic-ai/sdk';
import { ANALYSIS_PROMPT } from '../config/prompts.js';
import type { ArticleRow, AnalysisResult, Sentiment } from '../types/index.js';

function buildPrompt(article: ArticleRow): string {
  return ANALYSIS_PROMPT
    .replace('{title}', article.title)
    .replace('{content}', article.content_snippet || 'No content available')
    .replace('{source}', article.source);
}

function validateSentiment(value: string): Sentiment {
  const valid: Sentiment[] = ['positive', 'negative', 'neutral'];
  if (valid.includes(value as Sentiment)) {
    return value as Sentiment;
  }
  return 'neutral';
}

function validateImpactScore(value: number): number {
  const score = Math.round(value);
  if (score >= 1 && score <= 5) return score;
  return 3;
}

export async function analyzeArticle(
  client: Anthropic,
  article: ArticleRow,
): Promise<AnalysisResult> {
  const prompt = buildPrompt(article);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Could not parse JSON from response: ${text.slice(0, 200)}`);
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const result: AnalysisResult = {
        summary_ko: typeof parsed.summary_ko === 'string' ? parsed.summary_ko : '요약 없음',
        industry_tags: Array.isArray(parsed.industry_tags)
          ? (parsed.industry_tags as string[]).filter((t) => typeof t === 'string')
          : [],
        sentiment: validateSentiment(String(parsed.sentiment || 'neutral')),
        impact_score: validateImpactScore(Number(parsed.impact_score || 3)),
        commentary: typeof parsed.commentary === 'string' ? parsed.commentary : '',
      };

      console.log(`[Analyzer] Analyzed: "${article.title.slice(0, 50)}" → ${result.sentiment}, impact: ${result.impact_score}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Analyzer] Attempt ${attempt}/3 for "${article.title.slice(0, 40)}": ${lastError.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  // Fallback analysis
  console.error(`[Analyzer] All attempts failed for "${article.title.slice(0, 40)}". Using fallback.`);
  return {
    summary_ko: `${article.title} — 자동 분석 실패. 원문을 직접 확인하세요.`,
    industry_tags: ['기술'],
    sentiment: 'neutral',
    impact_score: 3,
    commentary: '분석 중 오류가 발생했습니다.',
  };
}
