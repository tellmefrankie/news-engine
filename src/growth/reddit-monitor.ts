import 'dotenv/config';

/**
 * Reddit/HN Keyword Monitor
 * Scans for relevant posts and sends Telegram alerts for engagement opportunities.
 * Runs via cron every 15 minutes.
 */

const KEYWORDS = [
  'claude skills', 'claude code plugin', 'mcp server', 'claude agent',
  'investment agent', 'trading bot ai', 'stock monitor', 'options analysis ai',
  'multi agent', 'ai portfolio', 'claude code tutorial',
  'ai agent marketplace', 'mcp marketplace',
];

const SUBREDDITS = [
  'ClaudeAI', 'ChatGPT', 'LocalLLaMA', 'agentbuilders',
  'SideProject', 'IndieHackers', 'algotrading', 'stocks',
];

const HN_API = 'https://hn.algolia.com/api/v1';
const REDDIT_API = 'https://www.reddit.com';

interface RedditPost {
  title: string;
  url: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

interface HNHit {
  title: string;
  url: string;
  objectID: string;
  points: number;
  num_comments: number;
  created_at_i: number;
}

async function searchReddit(keyword: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(
        `${REDDIT_API}/r/${sub}/search.json?q=${encodeURIComponent(keyword)}&sort=new&t=day&limit=5`,
        { headers: { 'User-Agent': 'NewsEngine/1.0' } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const children = data?.data?.children || [];
      for (const child of children) {
        const d = child.data;
        posts.push({
          title: d.title,
          url: `https://reddit.com${d.permalink}`,
          subreddit: d.subreddit,
          score: d.score,
          num_comments: d.num_comments,
          created_utc: d.created_utc,
        });
      }
    } catch {
      // skip failed subreddit
    }
  }
  return posts;
}

async function searchHN(keyword: string): Promise<HNHit[]> {
  try {
    const res = await fetch(
      `${HN_API}/search?query=${encodeURIComponent(keyword)}&tags=story&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 86400}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || []).map((h: Record<string, unknown>) => ({
      title: h.title as string,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      objectID: h.objectID as string,
      points: (h.points as number) || 0,
      num_comments: (h.num_comments as number) || 0,
      created_at_i: (h.created_at_i as number) || 0,
    }));
  } catch {
    return [];
  }
}

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[Growth] Telegram not configured, printing to console');
    console.log(message);
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (error) {
    console.error('[Growth] Telegram send failed:', error);
  }
}

// Dedup: track seen URLs
const seenUrls = new Set<string>();

export async function runMonitor(): Promise<void> {
  console.log(`[Growth] Scanning Reddit + HN for opportunities...`);
  const newPosts: string[] = [];

  for (const keyword of KEYWORDS) {
    // Reddit
    const redditPosts = await searchReddit(keyword);
    for (const post of redditPosts) {
      if (seenUrls.has(post.url)) continue;
      seenUrls.add(post.url);
      newPosts.push(
        `[Reddit r/${post.subreddit}] ${post.title}\n` +
        `Score: ${post.score} | Comments: ${post.num_comments}\n` +
        `${post.url}`
      );
    }

    // HN
    const hnHits = await searchHN(keyword);
    for (const hit of hnHits) {
      if (seenUrls.has(hit.url)) continue;
      seenUrls.add(hit.url);
      newPosts.push(
        `[HN] ${hit.title}\n` +
        `Points: ${hit.points} | Comments: ${hit.num_comments}\n` +
        `${hit.url}`
      );
    }

    // Rate limit: 1 second between keyword searches
    await new Promise(r => setTimeout(r, 1000));
  }

  if (newPosts.length === 0) {
    console.log('[Growth] No new relevant posts found');
    return;
  }

  const message = `🔍 Growth Monitor: ${newPosts.length} new opportunities\n\n` +
    newPosts.slice(0, 10).join('\n\n━━━━━━━━━━━━━━━\n\n');

  await sendTelegramAlert(message);
  console.log(`[Growth] Found ${newPosts.length} new posts, alert sent`);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runMonitor().catch(console.error);
}
