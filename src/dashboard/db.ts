import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');

let db: Database.Database | null = null;

export function getDashboardDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    createDashboardTables(db);
    console.log(`[Dashboard DB] Connected to ${DB_PATH}`);
  }
  return db;
}

function createDashboardTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      owner TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      est_minutes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      seen_by_ceo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS team_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team TEXT NOT NULL,
      activity TEXT NOT NULL,
      result TEXT,
      created_at TEXT NOT NULL,
      seen_by_ceo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS skill_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      price TEXT,
      url TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS growth_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      score INTEGER DEFAULT 0,
      action_taken TEXT,
      created_at TEXT NOT NULL,
      seen_by_ceo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      decision TEXT NOT NULL,
      decided_by TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      seen_by_ceo INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'insight',
      parent_id INTEGER DEFAULT NULL,
      depth INTEGER DEFAULT 0,
      upvotes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      seen_by_ceo INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ceo_todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('[Dashboard DB] Tables created/verified');
  seedIfEmpty(database);
}

function seedIfEmpty(database: Database.Database): void {
  const count = (database.prepare('SELECT COUNT(*) as c FROM action_items').get() as { c: number }).c;
  if (count > 0) return;

  console.log('[Dashboard DB] Seeding initial data...');

  const now = '2026-05-12T23:00:00+09:00';

  // Action Items
  const insertAction = database.prepare(`
    INSERT INTO action_items (title, description, priority, owner, status, est_minutes, created_at, updated_at, seen_by_ceo)
    VALUES (@title, @description, @priority, @owner, @status, @est_minutes, @created_at, @updated_at, @seen_by_ceo)
  `);

  const actions = [
    {
      title: 'Gumroad Payout 설정 + Publish',
      description: '한국 은행 SWIFT + 계좌번호 입력 → Publish and continue. $29 번들 상품 즉시 판매 시작 가능.',
      priority: 'urgent',
      owner: 'CEO',
      status: 'todo',
      est_minutes: 5,
      created_at: now,
      updated_at: now,
      seen_by_ceo: 0,
    },
    {
      title: 'Agensi 유료 스킬 4개 등록',
      description: 'ZIP 드래그앤드롭 → 정보 복붙 → Submit. Investment Briefing Agent, Price Monitor, Options Flow, Multi-Agent Orchestrator.',
      priority: 'high',
      owner: 'CEO',
      status: 'todo',
      est_minutes: 10,
      created_at: now,
      updated_at: now,
      seen_by_ceo: 0,
    },
    {
      title: 'GitHub Public Repo 생성',
      description: 'ai-investment-skills 퍼블릭 레포 생성 → 무료 스킬 오픈소스 공개 → README에 Gumroad 번들 링크 추가.',
      priority: 'high',
      owner: 'dev-team',
      status: 'todo',
      est_minutes: 60,
      created_at: now,
      updated_at: now,
      seen_by_ceo: 0,
    },
    {
      title: 'Twitter/X 첫 BuildInPublic 스레드',
      description: 'Claude Code로 AI 투자 에이전트 만든 실전 경험 공유. Gumroad 번들 링크 포함.',
      priority: 'medium',
      owner: 'marketing',
      status: 'todo',
      est_minutes: 60,
      created_at: now,
      updated_at: now,
      seen_by_ceo: 0,
    },
    {
      title: 'Reddit/HN 관련 글 댓글 참여',
      description: 'Growth Monitor 알림 기반. AI agent / investment 관련 글에 가치있는 답변 + 자연스럽게 스킬 노출.',
      priority: 'medium',
      owner: 'CEO',
      status: 'todo',
      est_minutes: 15,
      created_at: now,
      updated_at: now,
      seen_by_ceo: 0,
    },
    {
      title: 'Cover Image / Thumbnail 제작',
      description: 'Gumroad + Agensi 상품 이미지 제작. Claude로 SVG 생성 또는 Canva 사용.',
      priority: 'low',
      owner: 'dev-team',
      status: 'todo',
      est_minutes: 30,
      created_at: now,
      updated_at: now,
      seen_by_ceo: 0,
    },
  ];

  for (const action of actions) {
    insertAction.run(action);
  }

  // Team Activity
  const insertActivity = database.prepare(`
    INSERT INTO team_activity (team, activity, result, created_at, seen_by_ceo)
    VALUES (@team, @activity, @result, @created_at, @seen_by_ceo)
  `);

  const activities = [
    {
      team: 'planning',
      activity: '5개 아이템 시장 분석 완료',
      result: 'AI 투자 에이전트 스킬 마켓 진입 결정. TAM $2.3B, 경쟁사 대비 가격 경쟁력 확인.',
      created_at: '2026-05-12T20:00:00+09:00',
      seen_by_ceo: 0,
    },
    {
      team: 'business',
      activity: '수익성 검증 + 실행 계획 완료',
      result: '무료 리드젠($0) + $29 번들 전략. Month 1 목표 $400-600, 손익분기점 15 판매.',
      created_at: '2026-05-12T20:30:00+09:00',
      seen_by_ceo: 0,
    },
    {
      team: 'dev',
      activity: '기술 평가 완료, 스킬 패키징 완료',
      result: '6개 스킬 ZIP 패키징 완료. 기존 코드 80% 재활용. 대시보드 DB화 + API 서버 구현.',
      created_at: '2026-05-12T23:30:00+09:00',
      seen_by_ceo: 0,
    },
    {
      team: 'marketing',
      activity: '자동화 파이프라인 설계 완료',
      result: 'Twitter BuildInPublic 전략 + Reddit/HN Growth Monitor 크론 설정. 30분 간격 자동 스캔.',
      created_at: '2026-05-12T21:00:00+09:00',
      seen_by_ceo: 0,
    },
    {
      team: 'market-research',
      activity: '마켓 Gap 분석 + 20개 스킬 아이디어 발굴',
      result: '경쟁사 대비 투자/금융 특화 스킬 부재 확인. 20개 추가 스킬 아이디어 백로그 작성.',
      created_at: '2026-05-12T21:30:00+09:00',
      seen_by_ceo: 0,
    },
    {
      team: 'growth',
      activity: 'Growth Monitor 초기 스캔: 81개 관련 포스트 발견',
      result: 'Reddit/HN에서 AI agent + investment 관련 81개 포스트 발견. 댓글 참여 기회 3개 식별.',
      created_at: '2026-05-12T22:30:00+09:00',
      seen_by_ceo: 0,
    },
  ];

  for (const activity of activities) {
    insertActivity.run(activity);
  }

  // Skill Registry
  const insertSkill = database.prepare(`
    INSERT INTO skill_registry (skill_name, platform, status, price, url, updated_at)
    VALUES (@skill_name, @platform, @status, @price, @url, @updated_at)
  `);

  const skills = [
    { skill_name: 'EV Calculator', platform: 'agensi', status: 'reviewing', price: 'Free', url: null, updated_at: now },
    { skill_name: 'News Sentiment Engine', platform: 'agensi', status: 'submitted', price: 'Free', url: null, updated_at: now },
    { skill_name: 'Investment Briefing Agent', platform: 'agensi', status: 'todo', price: 'Free', url: null, updated_at: now },
    { skill_name: 'Price Monitor & Alert', platform: 'agensi', status: 'todo', price: 'Free', url: null, updated_at: now },
    { skill_name: 'Options Flow Analyzer', platform: 'agensi', status: 'todo', price: 'Free', url: null, updated_at: now },
    { skill_name: 'Multi-Agent Orchestrator', platform: 'agensi', status: 'todo', price: 'Free', url: null, updated_at: now },
    { skill_name: 'AI Investment Agent Bundle (4 skills)', platform: 'gumroad', status: 'submitted', price: '$29', url: null, updated_at: now },
  ];

  for (const skill of skills) {
    insertSkill.run(skill);
  }

  // Growth Log
  const insertGrowth = database.prepare(`
    INSERT INTO growth_log (source, title, url, score, action_taken, created_at, seen_by_ceo)
    VALUES (@source, @title, @url, @score, @action_taken, @created_at, @seen_by_ceo)
  `);

  const growthItems = [
    {
      source: 'reddit',
      title: 'Growth Monitor 초기 스캔: 81개 관련 포스트 발견 (Reddit/HN)',
      url: null,
      score: 0,
      action_taken: null,
      created_at: '2026-05-12T22:30:00+09:00',
      seen_by_ceo: 0,
    },
    {
      source: 'anthropic',
      title: 'Anthropic "Agents for financial services" 공식 페이지 발견 — 시장 validation',
      url: 'https://www.anthropic.com/solutions/financial-services',
      score: 95,
      action_taken: null,
      created_at: '2026-05-12T23:00:00+09:00',
      seen_by_ceo: 0,
    },
    {
      source: 'reddit',
      title: '"Build your own stock analyst with Claude: 12-prompt system" — 경쟁 콘텐츠 발견',
      url: null,
      score: 42,
      action_taken: null,
      created_at: '2026-05-12T23:00:00+09:00',
      seen_by_ceo: 0,
    },
    {
      source: 'hn',
      title: 'Ask HN: Best tools for automated investment research in 2026?',
      url: null,
      score: 78,
      action_taken: null,
      created_at: '2026-05-12T23:15:00+09:00',
      seen_by_ceo: 0,
    },
  ];

  for (const item of growthItems) {
    insertGrowth.run(item);
  }

  // Decisions
  const insertDecision = database.prepare(`
    INSERT INTO decisions (topic, decision, decided_by, reason, created_at, seen_by_ceo)
    VALUES (@topic, @decision, @decided_by, @reason, @created_at, @seen_by_ceo)
  `);

  const decisions = [
    {
      topic: '사업 방향',
      decision: 'AI 에이전트 스킬 마켓플레이스 판매',
      decided_by: '전체 팀 합의',
      reason: '기존 코드 80% 재활용 가능. 즉시 수익화 가능한 최단 경로.',
      created_at: '2026-05-12T20:00:00+09:00',
      seen_by_ceo: 0,
    },
    {
      topic: '가격 전략',
      decision: '무료 리드젠 + 유료 $29 번들',
      decided_by: '사업팀 + 유저리서치',
      reason: '무료 2개로 신뢰 확보 → $29 번들 업셀. 경쟁사 대비 30% 저렴.',
      created_at: '2026-05-12T20:30:00+09:00',
      seen_by_ceo: 0,
    },
    {
      topic: '판매 채널',
      decision: 'Agensi(무료) + Gumroad(유료) + GitHub(오픈소스)',
      decided_by: '사업전략팀',
      reason: 'Agensi Payout US-only → 무료만. 유료는 Gumroad KRW 직접 지급. GitHub은 SEO + 신뢰도.',
      created_at: '2026-05-12T21:00:00+09:00',
      seen_by_ceo: 0,
    },
    {
      topic: '마케팅 전략',
      decision: 'Twitter BuildInPublic + Reddit/HN Growth Monitor',
      decided_by: '마케팅팀',
      reason: '개발 과정 공유로 팔로워 + 신뢰 구축. Growth Monitor로 댓글 기회 자동 포착.',
      created_at: '2026-05-12T21:30:00+09:00',
      seen_by_ceo: 0,
    },
    {
      topic: 'MVP 기간',
      decision: '2-3주 (기존 코드 80% 재활용)',
      decided_by: '개발팀',
      reason: 'news-engine 코드베이스 직접 활용. 추가 개발 최소화.',
      created_at: '2026-05-12T21:00:00+09:00',
      seen_by_ceo: 0,
    },
  ];

  for (const decision of decisions) {
    insertDecision.run(decision);
  }

  // CEO Todos
  const todoCount = (database.prepare('SELECT COUNT(*) as c FROM ceo_todos').get() as { c: number }).c;
  if (todoCount === 0) {
    const insertTodo = database.prepare(`
      INSERT INTO ceo_todos (title, description, priority, status, due_date, created_at, updated_at)
      VALUES (@title, @description, @priority, @status, @due_date, @created_at, @updated_at)
    `);

    const todos = [
      {
        title: 'Gumroad Payout 설정',
        description: '한국 은행 SWIFT + 계좌번호 입력 → Publish and continue. 완료하면 $29 번들 즉시 판매 시작.',
        priority: 'urgent',
        status: 'todo',
        due_date: '2026-05-13',
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Agensi 스킬 4개 추가 등록',
        description: 'Investment Briefing Agent, Price Monitor, Options Flow, Multi-Agent Orchestrator — ZIP 드래그앤드롭 후 정보 복붙.',
        priority: 'high',
        status: 'todo',
        due_date: '2026-05-14',
        created_at: now,
        updated_at: now,
      },
      {
        title: 'GitHub Public Repo 생성',
        description: 'ai-investment-skills 퍼블릭 레포 생성 → 무료 스킬 오픈소스 공개 → README에 Gumroad 번들 링크 추가.',
        priority: 'high',
        status: 'todo',
        due_date: '2026-05-15',
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Twitter/X BuildInPublic 스레드 작성',
        description: 'Claude Code로 AI 투자 에이전트 만든 실전 경험 공유. Gumroad 번들 링크 포함.',
        priority: 'medium',
        status: 'todo',
        due_date: '2026-05-16',
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Reddit/HN 댓글 참여',
        description: 'Growth Monitor 알림 기반. AI agent / investment 관련 글에 가치있는 답변 + 자연스럽게 스킬 노출.',
        priority: 'medium',
        status: 'todo',
        due_date: null,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const todo of todos) {
      insertTodo.run(todo);
    }
  }

  console.log('[Dashboard DB] Seed complete');
}

export function closeDashboardDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
