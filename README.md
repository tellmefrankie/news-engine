# AI Investment Skills for Claude Code

11 Claude Code skills — investment analysis, dev workflow, and debugging tools. All free. Built from 6 months of daily portfolio management — not a demo.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

---

## What this caught last week

```
Options Flow Summary — 2026-05-13

SPY  P/C: 0.44   [EXTREME BULLISH]
QQQ  P/C: 0.54   [BULLISH]
TEM  P/C: 0.50   [BULLISH]
RXRX P/C: 0.38   [EXTREME BULLISH]
IREN P/C: 0.83   [NEUTRAL]
XLI  P/C: 5.32   [OUTLIER — INSTITUTIONAL HEDGE SIGNAL] ⚠️
```

XLI's normal range is 0.5–1.2. At 5.32, someone is buying institutional-scale downside protection on industrials while the broad market signals bullish. The scanner caught it before market open.

[Full write-up →](https://dev.to/tellmefrankie/when-the-market-whispers-through-sector-etfs-the-xli-pc-532-signal-14l8)

---

## Skills

### 1. Options Flow Scanner

Pulls options chain data across your watchlist, calculates put/call ratios, and flags statistical outliers against each instrument's own historical baseline.

```
< 0.40  → EXTREME BULLISH
0.40–0.60 → BULLISH
0.60–1.20 → NEUTRAL
1.20–2.00 → CAUTIOUS
> 2.00  → BEARISH / HEDGE SIGNAL
> 3.00  → INSTITUTIONAL HEDGE SIGNAL
```

Key: outlier detection uses per-instrument baselines, not fixed thresholds. XLI at 5.32 fires because it's 4x above XLI's own historical average — not just because 5.32 is "high."

### 2. Stop-Loss Monitor

Polls your positions every 15 minutes during market hours. Fires a Telegram alert when price crosses a threshold.

```
TEM  current: $48.67 → stop: $49.75  [WATCH]
IREN current: $51.20 → stop: $50.00  [OK]
```

No checking required. The skill watches so you don't have to.

### 3. Daily Investment Briefing

9-wave morning analysis via Claude API. Runs in 90 seconds, outputs a structured Telegram message.

1. Overnight macro (futures, global markets)
2. Options flow (from Skill #1)
3. Sentiment overlay
4. Technical setup (support/resistance)
5. Risk assessment
6. Opportunity scan
7. Alert triggers
8. Trade ideas
9. Execution checklist

### 4. Portfolio Greeks Dashboard

Tracks delta exposure, sector concentration, and leverage across all open positions. Answers: "If the market drops 5% today, what happens to my book?"

### 5. Git Standup Generator

Reads your git log for the last 24 hours and generates a clean standup summary — yesterday / today / blockers. Works across multiple repos.

```
YESTERDAY
- Shipped lottery-call filter for options analyzer (6 commits)
- Fixed CI failure on awesome-list PR

TODAY
- Post-mortem write-up: XLI anomaly methodology

BLOCKERS
- dev.to daily publish limit — 3 articles queued for tomorrow
```

### 6. PR Review Prep

Generates a complete PR description from git diff: summary bullets, test plan checklist, risk assessment, and files needing careful review.

### 7. Claude API Cost Tracker

Breaks down Anthropic API spend by model, project, and task type. Flags expensive calls and identifies which tasks can switch from Opus to Sonnet.

### 8. Commit Roast

A brutal but accurate code review of your git commit history. Calls out vague messages, "fix the fix" chains, and 3 AM commit spikes — then gives 3 genuine suggestions. 30% comedy, 70% real feedback.

### 9. Context Budget Tracker

Know how much context window you have left before Claude loses memory mid-task. Estimates tokens used, shows biggest consumers, warns before you hit 85%. Includes checkpoint mode: generates a CHECKPOINT.md to paste into a fresh session.

### 10. Debug Trail

Automatically documents your debugging session as you go. Tracks hypotheses, dead ends, and discoveries. When the bug is fixed, generates a complete structured report — dead ends included, to prevent the next person repeating them.

### 11. Env Doctor

Diagnoses your `.env` file before deployment. Finds missing vars, placeholder values never replaced, wrong API key formats, trailing spaces, and Windows line ending issues. Validates Anthropic, Telegram, Polygon, and Stripe key formats.

---

## Quick Start (Free)

The Options Flow Scanner and Stop-Loss Monitor basics are free:

```bash
git clone https://github.com/tellmefrankie/news-engine
cd news-engine
pnpm install
cp .env.example .env
# Add ANTHROPIC_API_KEY + POLYGON_API_KEY
pnpm run:now
```

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `POLYGON_API_KEY` | Options data (Polygon.io — free tier works with `--delayed` flag) |
| `TELEGRAM_BOT_TOKEN` | Alerts delivery |
| `TELEGRAM_CHAT_ID` | Your chat or channel ID |

---

## Architecture

```
[Options Data]     [Price Feeds]     [Claude API]
Polygon.io ──→ Scanner ──→ Briefing Generator ──→ Telegram
                  │                                    │
                  └──────────── SQLite DB ─────────────┘

Scheduler: node-cron, runs daily 06:30 KST
```

Single Node.js process. No Lambda, no queue, no Kubernetes. `pm2 start` and forget.

---

## Full Bundle

The free tier covers the scanner and basic stop-loss alerts. The $29 bundle adds:

- Full 9-wave briefing with all Claude prompts
- Telegram alert formatting + multi-chat support  
- Configuration templates for different portfolio types
- Portfolio Greeks dashboard
- Priority updates

**[$29 one-time — no subscription →](https://jaehyunpark.gumroad.com/l/tcyahy)**

If the price goes up, existing buyers keep the current version.

---

## Contributing

Open issues:

- [#10 — Polygon.io free tier support](https://github.com/tellmefrankie/news-engine/issues/10) ← good first issue
- [#12 — Expand sector ETF watchlist (XLF, XLK, XLE)](https://github.com/tellmefrankie/news-engine/issues/12) ← good first issue  
- [#13 — Discord webhook support](https://github.com/tellmefrankie/news-engine/issues/13) ← help wanted

PRs welcome.

---

## License

MIT

---

*Not financial advice. Personal tooling. Do your own research.*
