# News Engine

AI/테크 뉴스를 자동 수집하고 Claude AI로 분석한 뒤 텔레그램 채널로 매일 아침 브리핑을 발송하는 파이프라인.

## Architecture

```
[뉴스 소스]          [수집기]          [분석기]         [발송기]
RSS Feeds ────→ Collector ────→ Analyzer ────→ Publisher
Naver API ──┘    (수집+중복제거)   (Claude API)    (Telegram)
                      │                │              │
                      └────── SQLite DB ──────────────┘

                    [스케줄러]
                    node-cron — 매일 06:00 KST
```

## Features

- **RSS 수집**: TechCrunch, The Verge, Ars Technica, Hacker News
- **네이버 뉴스 API**: AI, 인공지능, 테크, IT 키워드 검색
- **Claude AI 분석**: 50건 → 상위 5건 필터링, 한국어 요약/태그/호악재/영향도/총평
- **텔레그램 발송**: 카드 포맷 브리핑 메시지
- **스케줄러**: node-cron으로 매일 아침 6시 자동 실행
- **SQLite**: 수집/분석 데이터 영구 저장

## Tech Stack

- Node.js + TypeScript (strict)
- rss-parser, @anthropic-ai/sdk, grammy, better-sqlite3, node-cron
- tsup (build), tsx (dev)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in your API keys in .env
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `NAVER_CLIENT_ID` | Naver Search API client ID |
| `NAVER_CLIENT_SECRET` | Naver Search API client secret |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_CHANNEL_ID` | Telegram channel ID (e.g., `@channel_name` or `-100xxx`) |

## Usage

```bash
# Run full pipeline immediately
pnpm run:now

# Collect news only
pnpm dev -- --collect-only

# Analyze only (requires collected articles)
pnpm dev -- --analyze-only

# Publish only (requires analyzed articles)
pnpm dev -- --publish-only

# Start scheduler (runs daily at 06:00 KST)
pnpm dev

# Production
pnpm build
pnpm start
```

## Telegram Output Example

```
📰 AI 테크 뉴스 브리핑
2026.03.25 (화) 오전 6시

━━━━━━━━━━━━━━━━━

1️⃣ OpenAI, GPT-5 공개 임박
📊 영향도: ⭐⭐⭐⭐⭐ (5/5)
🏷 #AI #LLM #OpenAI
📈 호재

요약: OpenAI가 차세대 모델 GPT-5를 ...

💬 총평: 한국 AI 스타트업 생태계에 ...

🔗 https://...

━━━━━━━━━━━━━━━━━

Powered by NewsEngine | CodeFoundry
```

## Project Structure

```
src/
├── index.ts              # Entry point (scheduler/CLI)
├── pipeline.ts           # Pipeline orchestrator
├── collector/
│   ├── index.ts          # Unified collector
│   ├── rss.ts            # RSS feed collector
│   └── naver.ts          # Naver News API collector
├── analyzer/
│   ├── index.ts          # Analyzer main
│   ├── filter.ts         # Claude importance filter
│   └── analyze.ts        # Claude detailed analysis
├── publisher/
│   ├── index.ts          # Publisher main
│   └── telegram.ts       # Telegram message builder + sender
├── db/
│   ├── index.ts          # SQLite operations
│   └── schema.ts         # Table definitions
├── config/
│   ├── sources.ts        # RSS source list
│   └── prompts.ts        # Claude prompt templates
└── types/
    └── index.ts          # TypeScript type definitions
```

## License

MIT
