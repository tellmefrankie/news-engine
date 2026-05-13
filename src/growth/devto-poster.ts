import 'dotenv/config';
import fs from 'fs';
import path from 'path';

/**
 * dev.to Auto-Poster
 * Publishes blog drafts to dev.to via their free API.
 * Sets canonical_url for SEO to prevent duplicate content penalties.
 * Schedule: weekly on Mondays at 10:00 KST.
 */

const DEVTO_API = 'https://dev.to/api/articles';
const GUMROAD_LINK = 'https://jaehyunpark.gumroad.com/l/tcyahy';
const CANONICAL_BASE = 'https://jaehyunpark.gumroad.com'; // your canonical source

interface DevtoArticle {
  article: {
    title: string;
    published: boolean;
    body_markdown: string;
    tags: string[];
    canonical_url?: string;
    series?: string;
  };
}

interface DevtoResponse {
  id: number;
  title: string;
  url: string;
  path: string;
}

function appendGumroadCTA(body: string): string {
  if (body.includes(GUMROAD_LINK)) return body;

  const cta = `

---

## The scanner that caught this

This signal came from a Claude Code skill I run every morning before market open. It pulls options chain data, calculates P/C ratios across my watchlist, and flags anything statistically unusual — automatically, before I've had coffee.

The full bundle includes 4 production-tested skills:

- **Options Flow Scanner** — flags unusual P/C ratios like the XLI 5.32 read
- **Stop-Loss Monitor** — real-time price alerts via Telegram (caught my TEM position at $47.44)
- **Daily Investment Briefing** — 9-wave morning analysis, runs in 90 seconds
- **Portfolio Greeks Dashboard** — tracks concentration risk and leverage

I've been running these on a real portfolio for 6 months. Not a demo.

**[$29 one-time — no subscription](${GUMROAD_LINK})**

If the price ever goes up, existing buyers keep the current version forever.
`;
  return body + cta;
}

function extractTitle(markdown: string): string {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/);
    if (match) return match[1].trim();
  }
  return `AI Agent Dev — ${new Date().toISOString().split('T')[0]}`;
}

function extractTags(markdown: string): string[] {
  const defaultTags = ['ai', 'claude', 'buildinpublic', 'webdev'];
  const tagMatch = markdown.match(/^tags:\s*(.+)$/m);
  if (!tagMatch) return defaultTags;
  return tagMatch[1]
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/\s+/g, ''))
    .slice(0, 4);
}

export async function postToDevto(markdown: string, slugForCanonical?: string): Promise<DevtoResponse | null> {
  const apiKey = process.env.DEVTO_API_KEY;

  if (!apiKey) {
    console.log('[DevTo] DEVTO_API_KEY not set. Article that would be posted:');
    console.log('---');
    console.log(markdown.substring(0, 300) + '...');
    console.log('---');
    return null;
  }

  const bodyWithCTA = appendGumroadCTA(markdown);
  const title = extractTitle(bodyWithCTA);
  const tags = extractTags(bodyWithCTA);

  const slug = slugForCanonical || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonicalUrl = `${CANONICAL_BASE}/blog/${slug}`;

  const payload: DevtoArticle = {
    article: {
      title,
      published: true,
      body_markdown: bodyWithCTA,
      tags,
      canonical_url: canonicalUrl,
    },
  };

  try {
    const res = await fetch(DEVTO_API, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[DevTo] Failed to post (${res.status}):`, err);
      return null;
    }

    const data = await res.json() as DevtoResponse;
    console.log(`[DevTo] Article published: https://dev.to${data.path}`);
    return data;
  } catch (error) {
    console.error('[DevTo] Request failed:', error);
    return null;
  }
}

/**
 * Find the latest blog draft in content/ and post it to dev.to.
 */
export async function postLatestBlog(): Promise<DevtoResponse | null> {
  const contentDir = path.join(process.cwd(), 'content');

  if (!fs.existsSync(contentDir)) {
    console.error('[DevTo] content/ directory not found. Run content generator first.');
    return null;
  }

  const files = fs.readdirSync(contentDir)
    .filter(f => f.startsWith('blog-') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('[DevTo] No blog draft found in content/');
    return null;
  }

  const latestFile = path.join(contentDir, files[0]);
  const markdown = fs.readFileSync(latestFile, 'utf-8');
  console.log(`[DevTo] Posting: ${files[0]}`);

  // Mark as posted by renaming with suffix
  const result = await postToDevto(markdown, files[0].replace('blog-', '').replace('.md', ''));

  if (result) {
    const postedPath = latestFile.replace('.md', '.posted.md');
    fs.renameSync(latestFile, postedPath);
    console.log(`[DevTo] Marked as posted: ${path.basename(postedPath)}`);
  }

  return result;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  postLatestBlog().catch(console.error);
}
