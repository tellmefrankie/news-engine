import { execSync } from 'child_process';

/**
 * PR Tracker — awesome-claude-skills PR 머지 감지
 * Runs every 15 minutes via growth cron.
 * On merge: logs to growth_log + sends Telegram alert.
 */

interface TrackedPR {
  repo: string;
  number: number;
  title: string;
}

const TRACKED_PRS: TrackedPR[] = [
  { repo: 'karanb192/awesome-claude-skills', number: 78, title: 'Add news-sentiment-engine to Data & Analysis' },
  { repo: 'ComposioHQ/awesome-claude-skills', number: 822, title: 'Add ai-investment-skills to Investment & Finance section' },
];

const DASHBOARD_API = 'http://localhost:3847';

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[PRTracker] Telegram not configured:', message);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[PRTracker] Telegram send failed:', err);
  }
}

async function logToGrowth(title: string, url: string, note: string): Promise<void> {
  try {
    await fetch(`${DASHBOARD_API}/api/growth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'github-pr',
        title,
        url,
        score: 80,
        action_taken: note,
      }),
    });
  } catch (_) {
    console.error('[PRTracker] Failed to log to growth API');
  }
}

async function postDiscussion(title: string, content: string): Promise<void> {
  try {
    await fetch(`${DASHBOARD_API}/api/discussions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: 'ECHO', title, content, category: 'finding' }),
    });
  } catch (_) {}
}

function getPRState(repo: string, number: number): { state: string; mergedAt: string | null } | null {
  try {
    const raw = execSync(
      `gh api repos/${repo}/pulls/${number} --jq '{state: .state, mergedAt: .merged_at}'`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[PRTracker] gh api failed for ${repo}#${number}:`, err);
    return null;
  }
}

// Simple file-based state to avoid re-alerting on same merged PR
function getKnownMerged(): Set<string> {
  try {
    const raw = execSync('cat /tmp/echo-pr-tracker-merged.json 2>/dev/null || echo "[]"', { encoding: 'utf8' });
    return new Set(JSON.parse(raw));
  } catch (_) {
    return new Set();
  }
}

function saveKnownMerged(merged: Set<string>): void {
  try {
    execSync(`echo '${JSON.stringify([...merged])}' > /tmp/echo-pr-tracker-merged.json`);
  } catch (_) {}
}

export async function checkPRs(): Promise<void> {
  console.log('[PRTracker] Checking awesome-claude-skills PRs...');
  const knownMerged = getKnownMerged();
  let newMerges = false;

  for (const pr of TRACKED_PRS) {
    const key = `${pr.repo}#${pr.number}`;
    const result = getPRState(pr.repo, pr.number);

    if (!result) continue;

    console.log(`[PRTracker] ${key}: state=${result.state}, mergedAt=${result.mergedAt}`);

    if (result.state === 'closed' && result.mergedAt && !knownMerged.has(key)) {
      knownMerged.add(key);
      newMerges = true;

      const prUrl = `https://github.com/${pr.repo}/pull/${pr.number}`;
      const msg = `PR MERGED — awesome-claude-skills\n\n<b>${pr.title}</b>\nRepo: ${pr.repo}\nMerged: ${result.mergedAt}\n\n트래픽 유입 시작 예상. GitHub star + Gumroad 전환 모니터링 시작.`;

      await sendTelegramAlert(msg);
      await logToGrowth(
        `[MERGED] ${pr.title}`,
        prUrl,
        'awesome-claude-skills 리스트 머지 — 백링크 트래픽 유입 시작'
      );
      await postDiscussion(
        `[ECHO] PR 머지 감지 — ${pr.repo}#${pr.number}`,
        `awesome-claude-skills PR이 머지되었습니다.\n\n제목: ${pr.title}\nRepo: ${pr.repo}\nMerged At: ${result.mergedAt}\nURL: ${prUrl}\n\n백링크 트래픽 유입 예상. Agensi/Gumroad 전환율 모니터링 강화 필요.`
      );

      console.log(`[PRTracker] MERGED: ${key} — alerts sent`);
    }
  }

  if (newMerges) saveKnownMerged(knownMerged);
  console.log('[PRTracker] Check complete.');
}
