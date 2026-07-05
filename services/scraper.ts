import type { Candidate } from "@/types/product";

// TODO: portar la lógica de scraping con Playwright (Alibaba + MadeInChina).
// Recordar: selectores deben validarse contra los sitios reales.

export async function searchCandidates(query: string): Promise<Candidate[]> {
  throw new Error("TODO: implementar searchCandidates");
}
