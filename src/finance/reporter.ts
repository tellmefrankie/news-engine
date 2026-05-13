import { getAllRecords, getRecentRecords, getSnapshotHistory, type FinancialRecord } from './db.js';
import { calculateRunway, type RunwayResult } from './runway.js';

const STATUS_EMOJI: Record<string, string> = {
  GREEN: '🟢',
  YELLOW: '🟡',
  RED: '🔴',
};

function formatKrw(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}백만원`;
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

function formatRunwayMonths(months: number): string {
  if (months >= 999) return '∞ (흑자)';
  return `${months.toFixed(1)}개월`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

export function generateMonthlyReport(): string {
  const runway = calculateRunway();
  const allRecords = getAllRecords();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM

  const thisMonthRecords = allRecords.filter((r) => r.record_date.startsWith(thisMonth));
  const incomeRecords = thisMonthRecords.filter((r) => r.category === 'income');
  const expenseRecords = thisMonthRecords.filter((r) => r.category === 'expense');
  const assetRecords = allRecords.filter((r) => r.category === 'asset');

  const totalIncome = incomeRecords.reduce((s, r) => s + r.amount_krw, 0);
  const totalExpense = expenseRecords.reduce((s, r) => s + Math.abs(r.amount_krw), 0);
  const netFlow = totalIncome - totalExpense;

  const statusEmoji = STATUS_EMOJI[runway.status] ?? '⚪';

  const lines: string[] = [];
  lines.push(`📊 *DELTA 재무 월간 리포트*`);
  lines.push(`${getCurrentYearMonth()} 기준`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`*런웨이 상태: ${statusEmoji} ${runway.status}*`);
  lines.push(`예상 런웨이: ${formatRunwayMonths(runway.runwayMonths)}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📥 *이번 달 수입*');
  if (incomeRecords.length === 0) {
    lines.push('  기록 없음');
  } else {
    for (const r of incomeRecords) {
      const label = r.notes ?? r.source;
      lines.push(`  • ${label}: +${formatKrw(r.amount_krw)}`);
    }
    lines.push(`  합계: +${formatKrw(totalIncome)}`);
  }
  lines.push('');
  lines.push('📤 *이번 달 지출*');
  if (expenseRecords.length === 0) {
    lines.push('  기록 없음');
  } else {
    for (const r of expenseRecords) {
      const label = r.notes ?? r.source;
      lines.push(`  • ${label}: -${formatKrw(Math.abs(r.amount_krw))}`);
    }
    lines.push(`  합계: -${formatKrw(totalExpense)}`);
  }
  lines.push('');
  lines.push(`💰 *순현금흐름: ${netFlow >= 0 ? '+' : ''}${formatKrw(netFlow)}*`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('🏦 *자산 현황*');

  // Latest value per asset source
  const latestAssets = new Map<string, FinancialRecord>();
  for (const r of assetRecords) {
    if (!latestAssets.has(r.source)) {
      latestAssets.set(r.source, r);
    }
  }

  if (latestAssets.size === 0) {
    lines.push('  기록 없음');
  } else {
    let totalAsset = 0;
    for (const [source, r] of latestAssets) {
      const label = r.notes ?? source;
      lines.push(`  • ${label}: ${formatKrw(r.amount_krw)}`);
      totalAsset += r.amount_krw;
    }
    lines.push(`  총 자산: ${formatKrw(totalAsset)}`);
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📈 *3개월 평균 기준*');
  lines.push(`  월 수입: +${formatKrw(runway.monthlyIncome)}`);
  lines.push(`  월 지출: -${formatKrw(runway.monthlyExpense)}`);
  lines.push(`  월 순흐름: ${runway.netMonthly >= 0 ? '+' : ''}${formatKrw(runway.netMonthly)}`);
  lines.push('');
  lines.push('_Powered by DELTA Finance_');

  return lines.join('\n');
}

export function generateWeeklyReport(): string {
  const runway = calculateRunway();
  const recent = getRecentRecords(1); // last month
  const snapshots = getSnapshotHistory(4);

  const statusEmoji = STATUS_EMOJI[runway.status] ?? '⚪';
  const now = new Date();
  const weekStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  const lines: string[] = [];
  lines.push(`📊 *DELTA 주간 재무 요약*`);
  lines.push(`${weekStr} 기준`);
  lines.push('');
  lines.push(`런웨이: ${statusEmoji} ${formatRunwayMonths(runway.runwayMonths)}`);
  lines.push(`월 수입: +${formatKrw(runway.monthlyIncome)}`);
  lines.push(`월 지출: -${formatKrw(runway.monthlyExpense)}`);
  lines.push(`순현금흐름: ${runway.netMonthly >= 0 ? '+' : ''}${formatKrw(runway.netMonthly)}`);

  if (runway.stockValueKrw !== null) {
    lines.push(`주식 평가액: ${formatKrw(runway.stockValueKrw)}`);
  }

  lines.push('');

  if (snapshots.length >= 2) {
    const latest = snapshots[0];
    const prev = snapshots[1];
    if (latest && prev) {
      const diff = latest.runway_months - prev.runway_months;
      const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
      lines.push(`런웨이 변화: ${diffStr}개월 (전주 대비)`);
    }
  }

  lines.push('');
  lines.push('_DELTA Finance_');

  return lines.join('\n');
}
