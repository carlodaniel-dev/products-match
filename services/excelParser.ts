import type { Product } from "@/types/product";

// TODO: portar la lógica de lectura/escritura de Excel (xlsx) aquí.
// Columnas esperadas: DESCRIPTION NUEVA ESPAÑOL, DESCRIPTION NUEVA INGLES,
// TOTAL UNIT, PRICE, LINKS ORIGINAL.

export function parseExcel(filePath: string): Product[] {
  throw new Error("TODO: implementar parseExcel");
}

export function writeResultsExcel(products: Product[], outputPath: string): void {
  throw new Error("TODO: implementar writeResultsExcel");
}
