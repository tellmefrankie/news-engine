import { renderCards } from './card-generator.js';
import type { ConnectionAnalysis } from './types.js';

// 하드코딩된 샘플 데이터 — API 키 불필요
const sampleAnalysis: ConnectionAnalysis = {
  catalyst: '구글의 클라우드(인터넷 서버 임대) 사업 매출이 1년 만에 63% 폭증했다. AI를 쓰려면 서버가 필요한데, 그 서버를 빌려주는 구글이 역대급 매출을 올린 것.',
  catalystCompany: '구글 클라우드',
  catalystTicker: 'GOOGL',
  catalystNumber: '매출 +63%',
  beneficiaryCompany: '아이렌',
  beneficiaryTicker: 'IREN',
  beneficiaryDescription: 'AI 서버에 전기와 냉각을 제공하는 데이터센터 회사',
  connectionChain: [
    'AI 수요 폭증 → 서버가 더 필요하다',
    '서버가 늘어나면 → 전기와 냉각이 더 필요하다',
    '전기와 냉각을 파는 회사 → 아이렌(IREN)이 돈을 번다',
  ],
  evidence: [
    '아이렌은 마이크로소프트와 14조원(=$9.7B) 규모 5년 계약을 맺었다',
    '텍사스에 750MW 규모 데이터센터를 짓고 있다 (서울 아파트 75만 가구 전력량)',
    '구글·메타·마이크로소프트 3사가 올해 장비에만 1,000조원을 쓸 계획이다',
  ],
  risks: [
    '구글 한 곳에 매출이 집중되면, 구글이 직접 센터를 지을 경우 위험',
    '비트코인 채굴 사업을 접는 중이라 단기 매출이 줄 수 있다',
  ],
  takeaway: '구글 클라우드 +63%의 진짜 의미는 "AI 서버에 전기를 파는 회사"의 수혜. 삽을 파는 회사를 찾아라.',
  source: 'Alphabet 2026 Q1 실적 발표 (2026.04.29)',
};

async function main() {
  console.log('[Test] Rendering sample card news...');
  const files = await renderCards(sampleAnalysis, 'sample_google_iren');
  console.log(`[Test] Done! ${files.length} slides generated.`);
  console.log('[Test] Files:');
  files.forEach(f => console.log(`  ${f}`));
}

main().catch(console.error);
