import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConnectionAnalysis, CardSlide, InstagramPost } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../../output/cards');
const TEMPLATE_DIR = path.resolve(__dirname, 'templates');

/** Build slide content from connection analysis */
export function buildSlides(analysis: ConnectionAnalysis): CardSlide[] {
  return [
    {
      slideNumber: 1,
      type: 'hook',
      headline: `${analysis.catalystCompany}의 ${analysis.catalystNumber}`,
      body: `진짜 수혜 기업은\n따로 있습니다`,
      highlight: '← 밀어서 연결고리 확인',
    },
    {
      slideNumber: 2,
      type: 'context',
      headline: '무슨 일이 있었나?',
      body: analysis.catalyst,
      highlight: analysis.catalystNumber,
    },
    {
      slideNumber: 3,
      type: 'connection',
      headline: '숨겨진 연결고리',
      body: analysis.connectionChain.join('\n→ '),
      highlight: analysis.beneficiaryCompany,
    },
    {
      slideNumber: 4,
      type: 'evidence',
      headline: `왜 ${analysis.beneficiaryCompany}인가?`,
      body: analysis.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n\n'),
    },
    {
      slideNumber: 5,
      type: 'depth',
      headline: analysis.beneficiaryDescription,
      body: `${analysis.beneficiaryCompany} (${analysis.beneficiaryTicker})`,
    },
    {
      slideNumber: 6,
      type: 'risk',
      headline: '주의할 점',
      body: analysis.risks.map((r, i) => `${i + 1}. ${r}`).join('\n\n') +
        '\n\n본 콘텐츠는 투자 참고 자료이며,\n특정 종목의 매수/매도를 권유하지 않습니다.',
    },
    {
      slideNumber: 7,
      type: 'takeaway',
      headline: '결론',
      body: analysis.takeaway,
      highlight: '@hidden.link.us\n매일 아침, 숨겨진 연결고리',
    },
  ];
}

/** Build Instagram caption */
export function buildCaption(analysis: ConnectionAnalysis): string {
  const hashtags = [
    '#해외주식', '#미국주식', '#숨은수혜주', '#연결고리투자',
    '#주식카드뉴스', '#투자인사이트', '#주식공부',
    `#${analysis.beneficiaryTicker}`,
  ];

  return [
    `${analysis.catalystCompany}의 ${analysis.catalystNumber} — 뉴스만 보면 끝일까요?`,
    '',
    `뉴스 뒤에 숨은 연결고리를 따라가면`,
    `${analysis.beneficiaryCompany}이(가) 보입니다.`,
    '',
    analysis.takeaway,
    '',
    '이 분석이 도움됐다면 저장하고',
    '투자하는 친구에게 공유해주세요.',
    '',
    '—',
    hashtags.join(' '),
  ].join('\n');
}

/** Generate HTML for a single slide — v2 with visual design */
function generateSlideHtml(slide: CardSlide): string {
  const bg = '#0D1117';
  const text = '#E6EDF3';
  const accent = '#FFD700';
  const sub = '#8B949E';
  const green = '#00C087';
  const red = '#F6465D';
  const cardBg = '#161B22';

  // Slide-type specific icons
  const icons: Record<string, string> = {
    hook: '🔍',
    context: '📰',
    connection: '🔗',
    evidence: '📊',
    depth: '🏢',
    risk: '⚠️',
    takeaway: '💡',
  };
  const icon = icons[slide.type] || '';

  // Process body to add yellow highlights to key numbers/keywords
  function highlightBody(text: string): string {
    // Highlight percentages
    let result = text.replace(/(\+?\d+\.?\d*%)/g, `<span class="hl">$1</span>`);
    // Highlight dollar amounts
    result = result.replace(/(\$[\d,.]+[BMK]?)/g, `<span class="hl">$1</span>`);
    // Highlight Korean currency
    result = result.replace(/(\d+[조억만]원?)/g, `<span class="hl">$1</span>`);
    // Highlight arrows
    result = result.replace(/→/g, `<span class="arrow">→</span>`);
    return result;
  }

  const isHook = slide.type === 'hook';
  const isConnection = slide.type === 'connection';
  const isEvidence = slide.type === 'evidence';
  const isRisk = slide.type === 'risk';
  const isTakeaway = slide.type === 'takeaway';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1350px;
    background: ${isHook ? `linear-gradient(160deg, #0D1117 0%, #1a1f2e 50%, #0D1117 100%)` : bg};
    color: ${text};
    font-family: 'Pretendard', -apple-system, sans-serif;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: ${isHook ? '100px 80px' : '70px 80px'};
    position: relative;
    overflow: hidden;
  }
  /* Decorative elements */
  body::before {
    content: '';
    position: absolute;
    top: -100px; right: -100px;
    width: 400px; height: 400px;
    background: radial-gradient(circle, ${accent}08 0%, transparent 70%);
    border-radius: 50%;
  }
  body::after {
    content: '';
    position: absolute;
    bottom: -50px; left: -50px;
    width: 300px; height: 300px;
    background: radial-gradient(circle, ${accent}05 0%, transparent 70%);
    border-radius: 50%;
  }
  .top-bar {
    position: absolute; top: 0; left: 0; right: 0;
    height: 6px;
    background: linear-gradient(90deg, ${accent}, ${green}, ${accent});
  }
  .slide-number {
    position: absolute; top: 30px; right: 50px;
    color: ${sub}; font-size: 24px; font-weight: 300;
    letter-spacing: 2px;
  }
  .icon {
    font-size: ${isHook ? '80px' : '56px'};
    margin-bottom: ${isHook ? '30px' : '20px'};
    filter: drop-shadow(0 0 20px ${accent}40);
  }
  .label {
    font-size: 18px;
    color: ${accent};
    text-transform: uppercase;
    letter-spacing: 4px;
    font-weight: 600;
    margin-bottom: 20px;
  }
  .headline {
    font-size: ${isHook ? '68px' : '44px'};
    font-weight: 800;
    text-align: center;
    line-height: 1.25;
    margin-bottom: ${isHook ? '30px' : '30px'};
    color: ${isHook ? accent : text};
    ${isHook ? `text-shadow: 0 0 60px ${accent}30;` : ''}
    word-break: keep-all;
    max-width: 920px;
  }
  .divider {
    width: 80px; height: 3px;
    background: ${accent};
    margin: 20px 0 30px;
    border-radius: 2px;
  }
  .body {
    font-size: ${isHook ? '42px' : isEvidence ? '28px' : '30px'};
    font-weight: ${isHook ? '600' : '400'};
    text-align: ${isEvidence ? 'left' : 'center'};
    line-height: 1.7;
    color: ${text};
    max-width: 900px;
    word-break: keep-all;
  }
  .body .hl {
    color: ${accent};
    font-weight: 700;
    ${isHook ? `font-size: 48px;` : ''}
  }
  .body .arrow {
    color: ${accent};
    font-size: 36px;
    font-weight: 700;
  }
  ${isConnection ? `
  .body {
    background: ${cardBg};
    border-radius: 20px;
    padding: 40px 50px;
    border-left: 5px solid ${accent};
    font-size: 32px;
    line-height: 2.0;
  }` : ''}
  ${isEvidence ? `
  .body {
    background: ${cardBg};
    border-radius: 16px;
    padding: 40px;
    font-size: 27px;
    line-height: 1.9;
  }` : ''}
  ${isRisk ? `
  .body {
    font-size: 25px;
    line-height: 1.8;
    background: ${cardBg};
    border-radius: 16px;
    padding: 35px 40px;
    border-left: 5px solid ${red};
  }` : ''}
  .highlight {
    font-size: ${isHook ? '28px' : '22px'};
    color: ${isHook ? accent : sub};
    margin-top: ${isHook ? '50px' : '30px'};
    text-align: center;
    ${isHook ? 'animation: pulse 2s infinite; letter-spacing: 2px;' : ''}
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  ${isTakeaway ? `
  .body {
    font-size: 32px;
    font-weight: 600;
    line-height: 1.8;
    background: linear-gradient(135deg, ${cardBg}, #1e2530);
    border-radius: 20px;
    padding: 40px;
    border: 1px solid ${accent}30;
  }` : ''}
  .watermark {
    position: absolute;
    bottom: 25px;
    color: ${sub}80;
    font-size: 20px;
    letter-spacing: 1px;
  }
  .cta-box {
    margin-top: 30px;
    padding: 15px 30px;
    border: 2px solid ${accent};
    border-radius: 50px;
    color: ${accent};
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 1px;
  }
</style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="slide-number">${slide.slideNumber} / 7</div>
  <div class="icon">${icon}</div>
  ${!isHook ? `<div class="label">${slide.type.toUpperCase()}</div>` : ''}
  <div class="headline">${escapeHtml(slide.headline)}</div>
  <div class="divider"></div>
  <div class="body">${highlightBody(escapeHtml(slide.body)).replace(/\n/g, '<br>')}</div>
  ${slide.highlight && isTakeaway ? `<div class="cta-box">${escapeHtml(slide.highlight).replace(/\n/g, ' · ')}</div>` : ''}
  ${slide.highlight && isHook ? `<div class="highlight">${escapeHtml(slide.highlight)}</div>` : ''}
  ${slide.highlight && !isHook && !isTakeaway ? `<div class="highlight">${escapeHtml(slide.highlight).replace(/\n/g, '<br>')}</div>` : ''}
  <div class="watermark">@hidden.link.us</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render all slides to PNG files */
export async function renderCards(
  analysis: ConnectionAnalysis,
  outputSubDir?: string,
): Promise<string[]> {
  const slides = buildSlides(analysis);
  const dirName = outputSubDir || `${new Date().toISOString().split('T')[0]}_${analysis.beneficiaryTicker}`;
  const outputPath = path.join(OUTPUT_DIR, dirName);

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const outputFiles: string[] = [];

  try {
    for (const slide of slides) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1080, height: 1350 });

      const html = generateSlideHtml(slide);
      await page.setContent(html, { waitUntil: 'networkidle' });

      const filePath = path.join(outputPath, `slide_${slide.slideNumber}.png`);
      await page.screenshot({ path: filePath, type: 'png' });
      await page.close();

      outputFiles.push(filePath);
      console.log(`[CardGenerator] Rendered slide ${slide.slideNumber}: ${filePath}`);
    }
  } finally {
    await browser.close();
  }

  // Save caption
  const caption = buildCaption(analysis);
  const captionPath = path.join(outputPath, 'caption.txt');
  fs.writeFileSync(captionPath, caption, 'utf-8');
  console.log(`[CardGenerator] Caption saved: ${captionPath}`);

  // Save analysis JSON
  const jsonPath = path.join(outputPath, 'analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2), 'utf-8');

  return outputFiles;
}
