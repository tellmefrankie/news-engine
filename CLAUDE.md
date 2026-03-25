# News Engine — AI 테크 뉴스 분석 엔진 Claude Code 작업 지침서

## 프로젝트 개요
글로벌 AI/테크 뉴스를 자동 수집 → Claude API로 분석(요약, 관련 산업, 호재/악재, 영향 크기, 총평) → 텔레그램 채널로 매일 아침 자동 발송하는 파이프라인.
포트폴리오/실사용 겸용. SQLite에 저장하여 나중에 앱 백엔드로 재활용 가능.

## 기술 스택
- **런타임**: Node.js + TypeScript (strict)
- **뉴스 수집**: rss-parser (해외 RSS), Naver News Search API (한국 뉴스)
- **AI 분석**: Anthropic Claude API (@anthropic-ai/sdk)
- **텔레그램 발송**: grammy
- **데이터베이스**: SQLite (better-sqlite3)
- **스케줄링**: node-cron
- **환경변수**: dotenv
- **빌드**: tsx (실행), tsup (빌드)

---

## 아키텍처

```
[뉴스 소스]          [수집기]          [분석기]         [발송기]

RSS Feeds ────→ Collector ────→ Analyzer ────→ Publisher
Naver API ──┘    (수집+중복제거)   (Claude API)    (Telegram)
                      │                │              │
                      └────── SQLite DB ──────────────┘
                              (articles, analyses)

                    [스케줄러]
                    node-cron
                    매일 06:00 KST
```

### 데이터 흐름
1. **Collector**: RSS + Naver API에서 뉴스 50~100건 수집 → 중복 제거 → DB에 raw articles 저장
2. **Analyzer**: Claude API로 중요도 필터링(상위 5건 선정) → 각 뉴스 분석(요약/태그/호악재/영향도/총평) → DB에 분석 결과 저장
3. **Publisher**: 분석된 5건을 텔레그램 카드 포맷으로 발송
4. **Scheduler**: 매일 아침 6시(KST) 자동 실행 (Collector → Analyzer → Publisher)

---

## 뉴스 소스

### 한국 뉴스
| 소스 | 수집 방법 | 비고 |
|------|----------|------|
| 네이버 뉴스 | Naver Search API (news) | 키워드: "AI", "인공지능", "테크", "IT" |
| 전자신문 IT | RSS feed | etnews.com |
| 매일경제 | RSS feed | mk.co.kr IT 섹션 |

### 해외 뉴스
| 소스 | 수집 방법 | RSS URL |
|------|----------|---------|
| TechCrunch | RSS | https://techcrunch.com/feed/ |
| The Verge | RSS | https://www.theverge.com/rss/index.xml |
| Ars Technica | RSS | https://feeds.arstechnica.com/arstechnica/index |
| Hacker News | API/RSS | https://hnrss.org/frontpage |

---

## 폴더 구조

```
news-engine/
├── src/
│   ├── index.ts              # 메인 엔트리 (스케줄러 시작)
│   ├── pipeline.ts           # 파이프라인 오케스트레이터 (collect → analyze → publish)
│   ├── collector/
│   │   ├── index.ts          # 수집기 통합 (RSS + Naver 합치기, 중복 제거)
│   │   ├── rss.ts            # RSS 피드 수집 (rss-parser)
│   │   └── naver.ts          # 네이버 뉴스 API 수집
│   ├── analyzer/
│   │   ├── index.ts          # 분석기 메인 (필터링 + 분석)
│   │   ├── filter.ts         # Claude로 중요도 필터링 (50건 → 5건)
│   │   └── analyze.ts        # Claude로 개별 뉴스 상세 분석
│   ├── publisher/
│   │   ├── index.ts          # 발송기 메인
│   │   └── telegram.ts       # 텔레그램 카드 포맷 발송 (grammy)
│   ├── db/
│   │   ├── index.ts          # SQLite 초기화 + 쿼리 함수
│   │   └── schema.ts         # 테이블 스키마 정의
│   ├── config/
│   │   ├── sources.ts        # RSS 소스 목록
│   │   └── prompts.ts        # Claude API 프롬프트 템플릿
│   └── types/
│       └── index.ts          # 공통 타입 정의
├── data/
│   └── news.db               # SQLite 데이터베이스 파일 (gitignore)
├── .env.example              # 환경변수 예시
├── .env                      # 환경변수 (gitignore)
├── .gitignore
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

---

## 데이터베이스 스키마

### articles (수집된 원본 뉴스)
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,          -- 'techcrunch', 'theverge', 'naver', etc.
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,      -- 중복 제거 키
  published_at TEXT,             -- ISO 8601
  content_snippet TEXT,          -- 본문 요약 (300자)
  language TEXT DEFAULT 'en',    -- 'ko' or 'en'
  collected_at TEXT NOT NULL,    -- 수집 시각
  batch_id TEXT NOT NULL         -- 배치 ID (YYYY-MM-DD)
);
```

### analyses (AI 분석 결과)
```sql
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  batch_id TEXT NOT NULL,
  rank INTEGER NOT NULL,         -- 1~5 (중요도 순위)
  summary_ko TEXT NOT NULL,      -- 한국어 요약 (2~3문장)
  industry_tags TEXT NOT NULL,   -- JSON array: ["AI", "반도체", "클라우드"]
  sentiment TEXT NOT NULL,       -- 'positive' | 'negative' | 'neutral'
  impact_score INTEGER NOT NULL, -- 1~5 (영향 크기)
  commentary TEXT NOT NULL,      -- 총평 (1~2문장)
  analyzed_at TEXT NOT NULL,
  published_to_telegram INTEGER DEFAULT 0
);
```

---

## Claude API 프롬프트 설계

### 1단계: 중요도 필터링 프롬프트
```
당신은 AI/테크 뉴스 에디터입니다.
아래 뉴스 목록에서 한국 IT 업계 종사자에게 가장 중요한 5건을 선별하세요.

선별 기준:
- 산업 파급력이 큰 뉴스 우선
- 단순 제품 출시보다 기술 트렌드/정책/대형 M&A 우선
- 한국 시장에 영향을 미칠 가능성이 높은 뉴스 우선
- 중복/유사 뉴스는 하나만 선택

출력: 선택한 뉴스의 인덱스 번호 5개를 JSON 배열로 반환
```

### 2단계: 상세 분석 프롬프트
```
아래 뉴스를 분석하세요.

제목: {title}
내용: {content}
출처: {source}

다음 형식으로 JSON 응답:
{
  "summary_ko": "한국어 2~3문장 요약",
  "industry_tags": ["관련 산업 태그 2~4개"],
  "sentiment": "positive | negative | neutral",
  "impact_score": 1~5 (숫자),
  "commentary": "한국 IT 업계 관점에서의 총평 1~2문장"
}
```

---

## 텔레그램 메시지 포맷

```
📰 AI 테크 뉴스 브리핑
2026.03.25 (화) 오전 6시

━━━━━━━━━━━━━━━━━

1️⃣ [뉴스 제목]
📊 영향도: ⭐⭐⭐⭐⭐ (5/5)
🏷 #AI #반도체 #클라우드
📈 호재

요약: Claude가 생성한 2~3문장 한국어 요약

💬 총평: 한국 IT 업계 관점의 코멘트

🔗 원문 링크

━━━━━━━━━━━━━━━━━

2️⃣ [다음 뉴스...]
...

━━━━━━━━━━━━━━━━━

Powered by NewsEngine | CodeFoundry
```

---

## 환경변수 (.env)

```bash
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Naver Search API
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...

# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_ID=...   # @channel_name 또는 -100xxxxxxxxxx

# 설정
NEWS_BATCH_SIZE=50         # 수집할 최대 뉴스 수
NEWS_TOP_N=5               # 분석할 상위 뉴스 수
CRON_SCHEDULE=0 6 * * *    # 매일 아침 6시 (KST)
```

---

## Git 워크플로우 규칙

### 브랜치 전략
- `main`: 항상 실행 가능한 상태 유지
- `feat/*`: 기능 브랜치. 하나의 "기능 단위"마다 생성

### 커밋 규칙
- 잘게 쪼갠다. 하나의 커밋에 파일 변경 3~5개 이하
- 커밋 메시지 접두사: `feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`

### 커밋 작성자 규칙 (중요)
- 커밋 author는 절대 건드리지 말 것 (git config 그대로 → Jaehyun Park)
- Co-authored-by, Signed-off-by 같은 태그 넣지 말 것

### PR 규칙
- feature 브랜치 작업 완료 후 PR 생성
- 셀프 리뷰 후 머지

---

## 텔레그램 보고 규칙

### 반드시 텔레그램으로 알려야 하는 경우
1. **단계 완료 시**: "✅ 2단계 완료: 뉴스 수집기. 다음 3단계(분석기) 시작할까요?"
2. **빌드/런타임 에러 3회 연속**: 에러 요약과 함께 보고
3. **판단이 필요한 설계 결정**: API 구조, 프롬프트 설계 등
4. **외부 API 이슈**: Rate limit, 인증 실패 등

### 확인 없이 자율 진행
- 각 단계 내부의 세부 커밋
- 타입 에러, 린트 수정
- 모듈 리팩토링
- 테스트 데이터 생성

### 반드시 확인 받고 진행
- 다음 단계로 넘어갈 때
- 새로운 외부 API 추가
- DB 스키마 변경
- 텔레그램 채널에 실제 메시지 발송

---

## 작업 단계

### 1단계: 프로젝트 초기화 + DB 세팅
- [x] package.json, tsconfig.json, .gitignore 설정
- [x] 의존성 설치 (rss-parser, @anthropic-ai/sdk, grammy, better-sqlite3, node-cron, dotenv, tsx, tsup)
- [x] .env.example 생성
- [x] 타입 정의 (src/types/index.ts)
- [x] SQLite 초기화 + 스키마 생성 (src/db/)
- [x] 기본 실행 확인 (tsx src/index.ts)
- [x] 빌드 확인
**PR**: `feat/init-db-setup` → main

### 2단계: 뉴스 수집기 (Collector)
- [x] RSS 수집 모듈 (rss-parser, 4개 해외 소스)
- [x] 네이버 뉴스 API 수집 모듈
- [x] 수집기 통합 (중복 제거, DB 저장)
- [x] 소스 설정 (src/config/sources.ts)
- [x] 수집 테스트 (실제 RSS 피드에서 뉴스 가져오기)
- [x] 빌드 확인
**PR**: `feat/news-collector` → main

### 3단계: AI 분석기 (Analyzer)
- [x] Claude API 클라이언트 설정
- [x] 프롬프트 템플릿 (src/config/prompts.ts)
- [x] 중요도 필터링 모듈 (50건 → 5건)
- [x] 상세 분석 모듈 (요약/태그/호악재/영향도/총평)
- [x] 분석 결과 DB 저장
- [x] 분석 테스트 (수집된 데이터로 분석 실행)
- [x] 빌드 확인
**PR**: `feat/ai-analyzer` → main

### 4단계: 텔레그램 발송기 (Publisher)
- [ ] grammy 텔레그램 봇 설정
- [ ] 카드 포맷 메시지 생성
- [ ] 텔레그램 채널 발송 모듈
- [ ] 발송 테스트 (테스트 채널에 발송)
- [ ] 빌드 확인
**PR**: `feat/telegram-publisher` → main

### 5단계: 파이프라인 + 스케줄러
- [ ] 파이프라인 오케스트레이터 (collect → analyze → publish 순차 실행)
- [ ] node-cron 스케줄러 (매일 06:00 KST)
- [ ] CLI 명령어: `--now` (즉시 실행), `--collect-only`, `--analyze-only`, `--publish-only`
- [ ] 에러 핸들링 + 텔레그램 에러 알림
- [ ] 전체 파이프라인 테스트
- [ ] README.md 작성
- [ ] 빌드 확인
**PR**: `feat/pipeline-scheduler` → main

---

## 코드 품질 기준

### 코딩 규칙
- TypeScript strict 모드
- any 타입 사용 금지
- 모든 외부 API 호출에 에러 핸들링 + retry (최대 3회)
- 환경변수 누락 시 명확한 에러 메시지
- 로그: console.log → 접두사 포함 `[Collector]`, `[Analyzer]`, `[Publisher]`

### 빌드/실행 명령어
```bash
pnpm dev          # tsx로 개발 실행
pnpm start        # 스케줄러 모드 (node-cron)
pnpm run:now      # 즉시 파이프라인 실행
pnpm build        # tsup 빌드
```

---

## 컨텍스트 복구 규칙 (세션 재시작 시)
1. `git log --oneline -20` → 최근 커밋 확인
2. `gh pr list --state all` → PR 히스토리 확인
3. `git branch` → 현재 브랜치 확인
4. 이 CLAUDE.md의 체크리스트 → 완료/미완료 항목 확인

---

## 시작 가이드

### Step 1: 의존성 설치
```bash
pnpm init
pnpm add rss-parser @anthropic-ai/sdk grammy better-sqlite3 node-cron dotenv
pnpm add -D typescript @types/node @types/better-sqlite3 @types/node-cron tsx tsup
```

### Step 2: tsconfig.json 설정
strict 모드, ESM, paths alias 설정

### Step 3: 기본 구조 생성
위 폴더 구조대로 디렉토리 + 빈 파일 생성

### Step 4: DB 초기화 확인
```bash
pnpm dev
# → SQLite DB 생성 + 테이블 생성 확인
```

### Step 5: 초기 커밋 + 푸시
```bash
git add -A
git commit -m "chore: init project with TypeScript + SQLite setup"
git branch -M main
git push -u origin main
```
