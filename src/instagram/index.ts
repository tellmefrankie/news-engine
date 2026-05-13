import 'dotenv/config';
import { analyzeConnection } from './connection-analyzer.js';
import { renderCards, buildCaption } from './card-generator.js';

/**
 * Instagram Card News Pipeline
 *
 * Usage:
 *   npx tsx src/instagram/index.ts "Google Cloud 매출이 전년 대비 63% 급증했다" "IREN은 GPU 클라우드 호스팅 기업으로 Microsoft와 $9.7B 계약 보유"
 *   npx tsx src/instagram/index.ts --sample
 */

const SAMPLE_NEWS = 'Google Cloud 매출이 전년 대비 63% 급증하여 $20B를 달성했다. 모든 하이퍼스케일러가 AI 연산 인프라 부족을 호소하고 있다.';
const SAMPLE_CONTEXT = 'IREN은 호주 기반 GPU 클라우드 호스팅 기업으로, Microsoft와 $9.7B 5년 계약을 체결했다. 텍사스 750MW 캠퍼스에서 NVIDIA GB300 GPU를 배치 중이다.';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let newsEvent: string;
  let context: string;

  if (args.includes('--sample')) {
    newsEvent = SAMPLE_NEWS;
    context = SAMPLE_CONTEXT;
    console.log('[Instagram] Running with sample data...');
  } else if (args.length >= 1) {
    newsEvent = args[0];
    context = args[1] || '';
  } else {
    console.log('Usage:');
    console.log('  npx tsx src/instagram/index.ts "뉴스 이벤트" "추가 컨텍스트"');
    console.log('  npx tsx src/instagram/index.ts --sample');
    process.exit(1);
    return;
  }

  console.log('[Instagram] ============================');
  console.log('[Instagram] Card News Generator');
  console.log('[Instagram] ============================');
  console.log(`[Instagram] News: ${newsEvent.substring(0, 80)}...`);

  // Step 1: Analyze connection
  console.log('\n[Instagram] Step 1: Analyzing connection...');
  const analysis = await analyzeConnection(newsEvent, context);

  if (!analysis) {
    console.error('[Instagram] Failed to analyze connection');
    process.exit(1);
    return;
  }

  console.log(`[Instagram] Connection found: ${analysis.catalystCompany} → ${analysis.beneficiaryCompany}`);

  // Step 2: Generate card images
  console.log('\n[Instagram] Step 2: Generating card images...');
  const files = await renderCards(analysis);

  console.log('\n[Instagram] ============================');
  console.log('[Instagram] DONE!');
  console.log(`[Instagram] ${files.length} slides generated`);
  console.log(`[Instagram] Output: ${files[0]?.replace(/slide_\d+\.png$/, '')}`);
  console.log('[Instagram] ============================');
  console.log('\n[Instagram] Next: Review the cards and manually upload to Instagram.');
}

main().catch((error) => {
  console.error('[Instagram] Fatal error:', error);
  process.exit(1);
});
