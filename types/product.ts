export interface Product {
  rowIndex: number;
  descriptionEs: string;
  descriptionEn: string;
  totalUnit: string | number;
  price: string | number;
  originalLink: string;
  match?: MatchResult | null;
}

export interface Candidate {
  source: "Alibaba" | "MadeInChina";
  title: string;
  link: string;
  price: string;
  moq: string;
}

export interface MatchResult extends Partial<Candidate> {
  similarity?: number;
  reasoning?: string;
}

export type JobStatus = "processing" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  total: number;
  processed: number;
  products: Product[];
  outputPath?: string | null;
  error?: string;
}
