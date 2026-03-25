export const FILTER_PROMPT = `당신은 AI/테크 뉴스 에디터입니다.
아래 뉴스 목록에서 한국 IT 업계 종사자에게 가장 중요한 5건을 선별하세요.

선별 기준:
- 산업 파급력이 큰 뉴스 우선
- 단순 제품 출시보다 기술 트렌드/정책/대형 M&A 우선
- 한국 시장에 영향을 미칠 가능성이 높은 뉴스 우선
- 중복/유사 뉴스는 하나만 선택

출력: 선택한 뉴스의 인덱스 번호 5개를 JSON 배열로 반환하세요. 예: [0, 3, 7, 12, 25]
다른 텍스트 없이 JSON 배열만 반환하세요.`;

export const ANALYSIS_PROMPT = `아래 뉴스를 분석하세요.

제목: {title}
내용: {content}
출처: {source}

다음 형식으로 JSON 응답하세요. JSON만 반환하고 다른 텍스트는 포함하지 마세요:
{
  "summary_ko": "한국어 2~3문장 요약",
  "industry_tags": ["관련 산업 태그 2~4개"],
  "sentiment": "positive | negative | neutral",
  "impact_score": 1~5,
  "commentary": "한국 IT 업계 관점에서의 총평 1~2문장"
}`;
