import type { Candidate, MatchResult, Product } from "@/types/product";

// TODO: portar la lógica de matching (embeddings de pre-filtro + GPT-4o para elegir el mejor candidato).

export async function matchProduct(
  product: Product,
  candidates: Candidate[]
): Promise<MatchResult | null> {
  throw new Error("TODO: implementar matchProduct");
}
