/** Hidden connection analysis for card news */
export interface ConnectionAnalysis {
  /** The catalyst event (plain Korean, no jargon) */
  catalyst: string;
  /** The catalyst company name in Korean */
  catalystCompany: string;
  /** The catalyst ticker */
  catalystTicker: string;
  /** Key number from the catalyst */
  catalystNumber: string;
  /** The hidden beneficiary company name in Korean */
  beneficiaryCompany: string;
  /** The beneficiary ticker */
  beneficiaryTicker: string;
  /** What the beneficiary company does (1 sentence, plain Korean) */
  beneficiaryDescription: string;
  /** The connection chain - 3 steps max */
  connectionChain: string[];
  /** Evidence points - 3 max */
  evidence: string[];
  /** Risk factors - 2-3 */
  risks: string[];
  /** One-line takeaway */
  takeaway: string;
  /** Source article/data */
  source: string;
}

/** Card news slide content */
export interface CardSlide {
  slideNumber: number;
  type: 'hook' | 'context' | 'connection' | 'evidence' | 'depth' | 'risk' | 'takeaway';
  headline: string;
  body: string;
  highlight?: string;
}

/** Instagram post data */
export interface InstagramPost {
  slides: CardSlide[];
  caption: string;
  hashtags: string[];
  connectionAnalysis: ConnectionAnalysis;
  generatedAt: string;
  posted: boolean;
}
