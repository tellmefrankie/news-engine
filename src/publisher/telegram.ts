import { Bot } from 'grammy';
import type { AnalysisRow, ArticleRow, Sentiment } from '../types/index.js';

type AnalysisWithArticle = AnalysisRow & ArticleRow;

const SENTIMENT_EMOJI: Record<Sentiment, string> = {
  positive: '\u{1F4C8} 호재',
  negative: '\u{1F4C9} 악재',
  neutral: '\u{2696}\u{FE0F} 중립',
};

const NUMBER_EMOJI = ['\u0031\u{FE0F}\u20E3', '\u0032\u{FE0F}\u20E3', '\u0033\u{FE0F}\u20E3', '\u0034\u{FE0F}\u20E3', '\u0035\u{FE0F}\u20E3'];

function getStars(score: number): string {
  return '\u2B50'.repeat(Math.min(score, 5));
}

function formatDate(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);

  const days = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  const dayName = days[kst.getDay()];

  return `${year}.${month}.${day} (${dayName})`;
}

function buildNewsCard(item: AnalysisWithArticle, index: number): string {
  const emoji = NUMBER_EMOJI[index] || `${index + 1}.`;
  const tags = JSON.parse(item.industry_tags) as string[];
  const tagStr = tags.map((t) => `#${t}`).join(' ');
  const sentimentStr = SENTIMENT_EMOJI[item.sentiment] || SENTIMENT_EMOJI.neutral;
  const stars = getStars(item.impact_score);

  return [
    `${emoji} ${item.title}`,
    `\u{1F4CA} 영향도: ${stars} (${item.impact_score}/5)`,
    `\u{1F3F7} ${tagStr}`,
    `${sentimentStr}`,
    '',
    `요약: ${item.summary_ko}`,
    '',
    `\u{1F4AC} 총평: ${item.commentary}`,
    '',
    `\u{1F517} ${item.url}`,
  ].join('\n');
}

export function buildTelegramMessage(items: AnalysisWithArticle[]): string {
  const dateStr = formatDate();
  const separator = '\u2501'.repeat(17);

  const header = [
    '\u{1F4F0} AI 테크 뉴스 브리핑',
    `${dateStr} 오전 6시`,
    '',
    separator,
  ].join('\n');

  const cards = items
    .map((item, i) => buildNewsCard(item, i))
    .join(`\n\n${separator}\n\n`);

  const footer = [
    '',
    separator,
    '',
    'Powered by NewsEngine | CodeFoundry',
  ].join('\n');

  return `${header}\n\n${cards}${footer}`;
}

export async function sendToTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!token || !channelId) {
    console.error('[Publisher:Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not set.');
    return;
  }

  const bot = new Bot(token);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await bot.api.sendMessage(channelId, message, {
        parse_mode: undefined, // plain text
        link_preview_options: { is_disabled: true },
      });
      console.log('[Publisher:Telegram] Message sent successfully');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Publisher:Telegram] Attempt ${attempt}/3 failed: ${lastError.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  throw new Error(`[Publisher:Telegram] Failed to send after 3 attempts: ${lastError?.message}`);
}

export async function sendErrorAlert(errorMessage: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!token || !channelId) return;

  try {
    const bot = new Bot(token);
    const text = `\u26A0\uFE0F NewsEngine Error\n\n${errorMessage}\n\n${formatDate()}`;
    await bot.api.sendMessage(channelId, text);
  } catch (error) {
    console.error('[Publisher:Telegram] Failed to send error alert:', error);
  }
}
