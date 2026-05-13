import Anthropic from '@anthropic-ai/sdk';
import type { ConnectionAnalysis } from './types.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `당신은 주식 시장의 숨겨진 연결고리를 찾는 분석가입니다.
뉴스 이벤트가 주어지면, 대부분의 사람들이 놓치는 2차/3차 수혜 기업을 찾아 연결고리를 분석합니다.

중요 규칙:
1. 일반인이 이해할 수 있는 쉬운 한국어로 작성하세요. 전문 용어 사용 시 반드시 괄호 안에 설명을 붙이세요.
2. 티커 심볼(IREN, RXRX 등)로 소통하지 마세요. 회사가 "무엇을 하는지"로 먼저 설명하세요.
3. 연결고리는 최대 3단계로 표현하세요 (A → B → C).
4. 모든 근거는 구체적 숫자와 출처를 포함하세요.
5. 반드시 리스크도 함께 제시하세요.

JSON 형식으로 출력하세요.`;

const USER_PROMPT_TEMPLATE = `다음 뉴스/이벤트를 분석하고, 숨겨진 수혜 기업을 찾아주세요.

뉴스/이벤트:
{newsEvent}

추가 컨텍스트:
{context}

다음 JSON 형식으로 응답하세요:
{
  "catalyst": "촉매 이벤트 설명 (쉬운 한국어)",
  "catalystCompany": "촉매 기업 한국어 이름",
  "catalystTicker": "티커",
  "catalystNumber": "핵심 숫자 (예: +63%)",
  "beneficiaryCompany": "수혜 기업 한국어 이름",
  "beneficiaryTicker": "티커",
  "beneficiaryDescription": "이 회사가 하는 일 (일반인용 1문장)",
  "connectionChain": ["단계1", "단계2", "단계3"],
  "evidence": ["근거1 (숫자 포함)", "근거2", "근거3"],
  "risks": ["리스크1", "리스크2"],
  "takeaway": "한 줄 결론",
  "source": "출처"
}`;

export async function analyzeConnection(
  newsEvent: string,
  context: string = '',
): Promise<ConnectionAnalysis | null> {
  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{newsEvent}', newsEvent)
    .replace('{context}', context || '없음');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[ConnectionAnalyzer] No JSON found in response');
        continue;
      }

      const analysis = JSON.parse(jsonMatch[0]) as ConnectionAnalysis;
      console.log(`[ConnectionAnalyzer] Analysis complete: ${analysis.catalystCompany} → ${analysis.beneficiaryCompany}`);
      return analysis;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[ConnectionAnalyzer] Attempt ${attempt}/3 failed: ${msg}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return null;
}
