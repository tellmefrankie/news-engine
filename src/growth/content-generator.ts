import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

/**
 * Content Auto-Generator
 * Uses Claude API to generate marketing content from git activity and skill updates.
 * Outputs: tweets, blog drafts, newsletter snippets.
 */

const CONTENT_DIR = path.join(process.cwd(), 'content');

interface ContentOutput {
  tweets: string[];
  blogDraft: string;
  newsletterSnippet: string;
}

function getRecentGitActivity(): string {
  try {
    const { execSync } = require('child_process');
    const log = execSync('git log --oneline -10 2>/dev/null || echo "no git history"', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    return log.trim();
  } catch {
    return 'no git history available';
  }
}

function getSkillsList(): string {
  const skillsDir = path.join(process.cwd(), 'skills');
  if (!fs.existsSync(skillsDir)) return 'No skills directory';

  const skills = fs.readdirSync(skillsDir);
  return skills.map(s => {
    const skillMd = path.join(skillsDir, s, 'SKILL.md');
    if (!fs.existsSync(skillMd)) return `- ${s}`;
    const content = fs.readFileSync(skillMd, 'utf-8');
    const firstLine = content.split('\n').find(l => l.startsWith('# '));
    return `- ${firstLine?.replace('# ', '') || s}`;
  }).join('\n');
}

export async function generateContent(): Promise<ContentOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[Content] ANTHROPIC_API_KEY not set');
    return null;
  }

  const client = new Anthropic({ apiKey });
  const gitActivity = getRecentGitActivity();
  const skills = getSkillsList();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a developer marketing writer. Generate content for an AI agent skills creator.

Context:
- Building Claude Code skills for investment analysis, price monitoring, options flow analysis
- Recent git activity: ${gitActivity}
- Available skills: ${skills}

Generate:
1. **3 tweets** (max 280 chars each) for #BuildInPublic. Mix of: progress update, insight shared, skill showcase. Be authentic, not salesy.
2. **Blog post draft** (300 words) — a practical tutorial or insight about building AI agents. Include code examples or real data.
3. **Newsletter snippet** (100 words) — weekly update for "AI Agent Weekly" subscribers.

Output as JSON:
{
  "tweets": ["tweet1", "tweet2", "tweet3"],
  "blogDraft": "full blog post",
  "newsletterSnippet": "newsletter text"
}

Tone: technical but accessible. Show real experience, not hype.`
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as ContentOutput;
  } catch {
    console.error('[Content] Failed to parse response');
    return null;
  }
}

export async function saveContent(): Promise<void> {
  const content = await generateContent();
  if (!content) return;

  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const date = new Date().toISOString().split('T')[0];

  // Save tweets
  const tweetsFile = path.join(CONTENT_DIR, `tweets-${date}.txt`);
  fs.writeFileSync(tweetsFile, content.tweets.join('\n\n---\n\n'));
  console.log(`[Content] Tweets saved: ${tweetsFile}`);

  // Save blog draft
  const blogFile = path.join(CONTENT_DIR, `blog-${date}.md`);
  fs.writeFileSync(blogFile, content.blogDraft);
  console.log(`[Content] Blog draft saved: ${blogFile}`);

  // Save newsletter
  const nlFile = path.join(CONTENT_DIR, `newsletter-${date}.md`);
  fs.writeFileSync(nlFile, content.newsletterSnippet);
  console.log(`[Content] Newsletter saved: ${nlFile}`);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  saveContent().catch(console.error);
}
