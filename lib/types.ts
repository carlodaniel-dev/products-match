export const REQUIRED_COLUMNS = [
  "DESCRIPTION NUEVA ESPAÑOL",
  "DESCRIPTION NUEVA INGLES",
  "TOTAL UNIT",
  "PRICE",
  "LINKS ORIGINAL",
] as const;

export type ProductInput = {
  descriptionEs: string;
  descriptionEn: string;
  totalUnits: string;
  targetPrice: string;
  originalLink: string;
};


export type CandidateReviewStatus = "aprobado" | "negado" | "revision";

export type Candidate = {
  title: string;
  url: string;
  marketplace: "Alibaba" | "Made-in-China";
  supplier: string;
  listedPrice: string;
  minimumOrder: string;
  score: number;
  confidence: "alta" | "media" | "baja";
  matches: string[];
  differences: string[];
  rationale: string;
  reviewStatus?: CandidateReviewStatus;
};

export type SearchMetrics = {
  model: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  candidatesBeforeFilter?: number;
  candidatesAfterFilter?: number;
  skippedOpenAI?: boolean;
};

export type SearchResult = {
  summary: string;
  warnings: string[];
  candidates: Candidate[];
  metrics?: SearchMetrics;
};

export type ProductRow = ProductInput & {
  id: string;
  sourceRow: number;
  result?: SearchResult;
  status: "pendiente" | "buscando" | "listo" | "error";
  error?: string;
};
