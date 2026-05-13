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

## Terminal Output Examples

**Options sentiment scan (`pnpm options:sentiment`):**

```
📊 옵션 센티먼트 (Massive API)

보유:
CEG  $299.69 | P/C 1.06 ⚠️  약한 베어리시 | IV 110.26%
IREN $55.15  | P/C 0.83 ➡️  중립-불리시   | IV 167.72%
KTOS $56.99  | P/C 0.53 ✅  불리시        | IV 170.1%
RXRX $3.26   | P/C 0.38 🔥  극단 불리시   | IV 189.58%
TEM  $48.46  | P/C 0.50 ✅  불리시        | IV 96.99%

섹터:
XLI | P/C 5.32 🔴 베어리시
SPY | P/C 0.44 🔥 극단 불리시
QQQ | P/C 0.54 ✅ 불리시
```

**Price monitor (`pnpm monitor:once`):**

```
[Monitor] PRE-MARKET — checking prices...
📊 가격 체크 결과:
  IREN: $56.93 (+3.23%) | 손절 $39    | 여유 46.0% ✅
  TEM:  $47.19 (-2.62%) | 손절 $49.75 | 여유 -5.1% 🚨 손절!
  RXRX: $3.15  (-3.37%) | 손절 $2.85  | 여유 10.5% ✅
  KTOS: $57.47 (+0.84%) | 손절 $52    | 여유 10.5% ✅
  CEG:  $294.81(-1.63%) | 손절 $253   | 여유 16.5% ✅
[Monitor] ALERT: 🚨 손절 알림: TEM $47.19 — 손절가 $49.75 도달. 장 시작 매도
```

**Runway snapshot (`pnpm finance:snapshot`):**

```
=== 런웨이 스냅샷 ===
날짜:        2026-05-13
상태:        GREEN
런웨이:      ∞ (흑자)
월 수입:     2,500,000원
월 지출:       310,000원
주식 평가액: 29,200,000원
현금:         8,000,000원
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
