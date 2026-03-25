/** Raw article collected from RSS or Naver API */
export interface Article {
  id?: number;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  content_snippet: string | null;
  language: 'ko' | 'en';
  collected_at: string;
  batch_id: string;
}

/** Sentiment classification */
export type Sentiment = 'positive' | 'negative' | 'neutral';

/** AI analysis result for a single article */
export interface Analysis {
  id?: number;
  article_id: number;
  batch_id: string;
  rank: number;
  summary_ko: string;
  industry_tags: string[];
  sentiment: Sentiment;
  impact_score: number;
  commentary: string;
  analyzed_at: string;
  published_to_telegram: number;
}

/** Analysis result as returned from Claude API (before DB insert) */
export interface AnalysisResult {
  summary_ko: string;
  industry_tags: string[];
  sentiment: Sentiment;
  impact_score: number;
  commentary: string;
}

/** RSS feed source configuration */
export interface RssSource {
  name: string;
  url: string;
  language: 'ko' | 'en';
}

/** Naver API search keyword */
export interface NaverSearchConfig {
  keywords: string[];
  display: number;
  sort: 'date' | 'sim';
}

/** Pipeline execution options */
export interface PipelineOptions {
  collectOnly?: boolean;
  analyzeOnly?: boolean;
  publishOnly?: boolean;
}

/** Article row from DB (with id guaranteed) */
export interface ArticleRow extends Required<Pick<Article, 'id'>> {
  id: number;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  content_snippet: string | null;
  language: string;
  collected_at: string;
  batch_id: string;
}

/** Analysis row from DB (with id guaranteed) */
export interface AnalysisRow extends Required<Pick<Analysis, 'id'>> {
  id: number;
  article_id: number;
  batch_id: string;
  rank: number;
  summary_ko: string;
  industry_tags: string;
  sentiment: Sentiment;
  impact_score: number;
  commentary: string;
  analyzed_at: string;
  published_to_telegram: number;
}
