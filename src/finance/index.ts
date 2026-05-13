import 'dotenv/config';
import { createSnapshot, calculateRunway, getLatestSnapshot } from './runway.js';
import { generateMonthlyReport, generateWeeklyReport } from './reporter.js';
import { insertRecord, closeFinanceDb } from './db.js';

function printUsage(): void {
  console.log(`
DELTA Finance CLI

Usage:
  tsx src/finance/index.ts --snapshot
  tsx src/finance/index.ts --report
  tsx src/finance/index.ts --weekly
  tsx src/finance/index.ts --add-income <amount> <source> [notes]
  tsx src/finance/index.ts --add-expense <amount> <source> [notes]

Commands:
  --snapshot              런웨이 스냅샷 생성 및 출력
  --report                월간 재무 리포트 출력
  --weekly                주간 요약 출력
  --add-income            수입 기록 추가
  --add-expense           지출 기록 추가 (양수로 입력)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case '--snapshot': {
        console.log('[Finance] 런웨이 스냅샷 생성 중...');
        const snapshot = createSnapshot();
        console.log('\n=== 런웨이 스냅샷 ===');
        console.log(`날짜: ${snapshot.snapshot_date}`);
        console.log(`상태: ${snapshot.status}`);
        console.log(`런웨이: ${snapshot.runway_months >= 999 ? '∞ (흑자)' : snapshot.runway_months.toFixed(1) + '개월'}`);
        console.log(`월 수입: ${snapshot.monthly_income.toLocaleString('ko-KR')}원`);
        console.log(`월 지출: ${snapshot.monthly_expense.toLocaleString('ko-KR')}원`);
        if (snapshot.stock_value_krw !== null) {
          console.log(`주식 평가액: ${snapshot.stock_value_krw.toLocaleString('ko-KR')}원`);
        }
        if (snapshot.cash_krw !== null) {
          console.log(`현금: ${snapshot.cash_krw.toLocaleString('ko-KR')}원`);
        }
        break;
      }

      case '--report': {
        console.log('[Finance] 월간 리포트 생성 중...');
        const report = generateMonthlyReport();
        console.log('\n' + report);
        break;
      }

      case '--weekly': {
        console.log('[Finance] 주간 요약 생성 중...');
        const weekly = generateWeeklyReport();
        console.log('\n' + weekly);
        break;
      }

      case '--add-income': {
        const amountStr = args[1];
        const source = args[2];
        const notes = args[3];
        if (!amountStr || !source) {
          console.error('Usage: --add-income <amount> <source> [notes]');
          process.exit(1);
        }
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) {
          console.error('amount must be a positive integer');
          process.exit(1);
        }
        const id = insertRecord('income', source, amount, notes);
        console.log(`[Finance] 수입 기록 추가됨 (id=${id}): +${amount.toLocaleString('ko-KR')}원 [${source}]`);
        break;
      }

      case '--add-expense': {
        const amountStr = args[1];
        const source = args[2];
        const notes = args[3];
        if (!amountStr || !source) {
          console.error('Usage: --add-expense <amount> <source> [notes]');
          process.exit(1);
        }
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) {
          console.error('amount must be a positive integer (will be stored as negative)');
          process.exit(1);
        }
        const id = insertRecord('expense', source, -amount, notes);
        console.log(`[Finance] 지출 기록 추가됨 (id=${id}): -${amount.toLocaleString('ko-KR')}원 [${source}]`);
        break;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
      }
    }
  } finally {
    closeFinanceDb();
  }
}

main().catch((err) => {
  console.error('[Finance] Error:', err);
  closeFinanceDb();
  process.exit(1);
});
