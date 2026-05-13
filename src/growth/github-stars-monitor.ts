/**
 * GitHub Stars Monitor — ai-investment-skills repo 수치 추적
 * 15분마다 실행. 변화 감지 시 Growth Monitor 기록 + Telegram 알림.
 */

const REPO = 'tellmefrankie/ai-investment-skills';
const DASHBOARD_API = 'http://localhost:3847';

interface RepoStats {
  stars: number;
  forks: number;
  watchers: number;
}

interface Snapshot {
  stars: number;
  forks: number;
  fetchedAt: string;
}

async function fetchRepoStats(): Promise<RepoStats | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { 'User-Agent': 'echo-dashboard-monitor' },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    return {
      stars: data.stargazers_count as number,
      forks: data.forks_count as number,
      watchers: data.watchers_count as number,
    };
  } catch (err) {
    console.error('[GitHubStars] fetch failed:', err);
    return null;
  }
}

function getLastSnapshot(): Snapshot | null {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const raw = execSync('cat /tmp/echo-github-stars.json 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch (_) {
    return null;
  }
}

function saveSnapshot(snapshot: Snapshot): void {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const safe = JSON.stringify(snapshot).replace(/'/g, '"');
    execSync(`echo '${safe}' > /tmp/echo-github-stars.json`);
  } catch (_) {}
}

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[GitHubStars] Telegram not configured:', message);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[GitHubStars] Telegram send failed:', err);
  }
}

async function logToGrowth(title: string, note: string, score: number): Promise<void> {
  try {
    await fetch(`${DASHBOARD_API}/api/growth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'github-stars',
        title,
        url: `https://github.com/${REPO}`,
        score,
        action_taken: note,
      }),
    });
  } catch (_) {
    console.error('[GitHubStars] Failed to log to growth API');
  }
}

export async function checkGitHubStars(): Promise<void> {
  console.log('[GitHubStars] Checking repo stats...');

  const stats = await fetchRepoStats();
  if (!stats) {
    console.log('[GitHubStars] Could not fetch stats, skipping.');
    return;
  }

  const now = new Date().toISOString();
  console.log(`[GitHubStars] stars=${stats.stars} forks=${stats.forks} watchers=${stats.watchers}`);

  const last = getLastSnapshot();
  const current: Snapshot = { stars: stats.stars, forks: stats.forks, fetchedAt: now };

  if (!last) {
    // 최초 실행 — 스냅샷만 저장, 알림 없음
    saveSnapshot(current);
    console.log('[GitHubStars] First run, snapshot saved.');
    return;
  }

  const starDelta = stats.stars - last.stars;
  const forkDelta = stats.forks - last.forks;

  if (starDelta > 0 || forkDelta > 0) {
    const parts: string[] = [];
    if (starDelta > 0) parts.push(`⭐ Stars: ${last.stars} → ${stats.stars} (+${starDelta})`);
    if (forkDelta > 0) parts.push(`🍴 Forks: ${last.forks} → ${stats.forks} (+${forkDelta})`);
    const summary = parts.join(' | ');

    const msg = `<b>GitHub 수치 상승</b>\n${summary}\nRepo: github.com/${REPO}`;
    await sendTelegramAlert(msg);

    const score = Math.min(100, 50 + starDelta * 10 + forkDelta * 15);
    await logToGrowth(
      `GitHub Stars +${starDelta} — ai-investment-skills`,
      summary,
      score
    );

    console.log(`[GitHubStars] Change detected: ${summary}`);
  } else {
    console.log(`[GitHubStars] No change. stars=${stats.stars} forks=${stats.forks}`);
  }

  saveSnapshot(current);
}
