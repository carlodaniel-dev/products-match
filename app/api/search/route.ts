import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  descriptionEs: z.string().max(4000),
  descriptionEn: z.string().max(4000),
  totalUnits: z.string().max(100),
  targetPrice: z.string().max(100),
  originalLink: z.string().max(2000),
});

const resultSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    candidates: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          marketplace: {
            type: "string",
            enum: ["Alibaba", "Made-in-China"],
          },
          supplier: { type: "string" },
          listedPrice: { type: "string" },
          minimumOrder: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          confidence: {
            type: "string",
            enum: ["alta", "media", "baja"],
          },
          matches: {
            type: "array",
            items: { type: "string" },
          },
          differences: {
            type: "array",
            items: { type: "string" },
          },
          rationale: { type: "string" },
        },
        required: [
          "title",
          "url",
          "marketplace",
          "supplier",
          "listedPrice",
          "minimumOrder",
          "score",
          "confidence",
          "matches",
          "differences",
          "rationale",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "warnings", "candidates"],
  additionalProperties: false,
} as const;

type CandidateResult = {
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
};

type SearchMetrics = {
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

type SupplierSearchResult = {
  summary: string;
  warnings: string[];
  candidates: CandidateResult[];
  metrics?: SearchMetrics;
};

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

function usageToMetrics(usage: OpenAIUsage | null | undefined) {
  return {
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
    totalTokens: usage?.total_tokens,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens,
  };
}

function isMarketplaceHost(hostname: string) {
  return (
    hostname === "alibaba.com" ||
    hostname.endsWith(".alibaba.com") ||
    hostname === "made-in-china.com" ||
    hostname.endsWith(".made-in-china.com")
  );
}

function isLikelyProductDetailUrl(url: URL) {
  const pathname = url.pathname.toLowerCase();
  const href = url.href.toLowerCase();

  if (!pathname || pathname === "/") return false;

  const nonProductMarkers = [
    "/trade/search",
    "/products-search",
    "/productdirectory",
    "/catalog",
    "/category",
    "/categories",
    "/showroom/",
    "/supplier/",
    "/company/",
    "/manufacturers/",
    "/wholesale/",
  ];

  if (nonProductMarkers.some((marker) => href.includes(marker))) return false;

  return (
    pathname.includes("product-detail") ||
    pathname.includes("productdetail") ||
    pathname.includes("/product/") ||
    pathname.endsWith(".html")
  );
}

function isAllowedCandidate(candidate: { url?: string }) {
  try {
    const url = new URL(candidate.url ?? "");
    const hostname = url.hostname.toLowerCase();
    return isMarketplaceHost(hostname) && isLikelyProductDetailUrl(url);
  } catch {
    return false;
  }
}

function normalizeUrlForComparison(value: string) {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$|^\s+|\s+$/g, "");
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function isOriginalLinkCandidate(candidate: { url?: string }, originalLink: string) {
  if (!candidate.url || !originalLink.trim()) return false;
  return normalizeUrlForComparison(candidate.url) === normalizeUrlForComparison(originalLink);
}

function normalizeNumberToken(value: string) {
  const token = value.replace(/[^\d.,]/g, "");
  const lastDot = token.lastIndexOf(".");
  const lastComma = token.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    return Number(token.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma >= 0) {
    const decimals = token.length - lastComma - 1;
    return Number(token.replaceAll(".", "").replace(",", decimals <= 2 ? "." : ""));
  }

  return Number(token.replaceAll(",", ""));
}

function extractNumbers(value: string) {
  return Array.from(value.matchAll(/\d+(?:[.,]\d+)*/g))
    .map((match) => normalizeNumberToken(match[0]))
    .filter((number) => Number.isFinite(number) && number > 0 && number < 100000);
}

function pickClosestPrice(listedPrice: string, targetPrice: number) {
  const prices = extractNumbers(listedPrice);
  if (!prices.length) return undefined;

  return prices.reduce((closest, price) =>
    Math.abs(price - targetPrice) < Math.abs(closest - targetPrice) ? price : closest,
  );
}

function priceScoreFromRatio(ratio: number) {
  if (ratio <= 0.1) return 100;
  if (ratio <= 0.25) return 90;
  if (ratio <= 0.5) return 70;
  if (ratio <= 1) return 45;
  if (ratio <= 2) return 20;
  return 5;
}

function confidenceFromScore(score: number): "alta" | "media" | "baja" {
  if (score >= 82) return "alta";
  if (score >= 58) return "media";
  return "baja";
}

function appendUnique(list: string[], note: string) {
  return list.some((item) => item.toLowerCase() === note.toLowerCase())
    ? list
    : [...list, note];
}

function normalizeLinkMarker(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasUsableOriginalLink(originalLink: string) {
  const cleanLink = originalLink.trim();
  if (!cleanLink) return false;

  const normalized = normalizeLinkMarker(cleanLink);
  const invalidMarkers = [
    "link incorrecto",
    "link erroneo",
    "enlace incorrecto",
    "enlace erroneo",
    "sin link",
    "sin enlace",
    "no link",
    "no enlace",
    "no disponible",
    "n/a",
    "na",
    "-",
    "--",
  ];

  if (invalidMarkers.includes(normalized)) return false;
  if (normalized.includes("link incorrecto") || normalized.includes("enlace incorrecto")) {
    return false;
  }

  try {
    const url = new URL(cleanLink);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function skippedMissingOriginalLinkResult(
  originalLink: string,
  durationMs = 0,
  model = process.env.OPENAI_MODEL || "gpt-4.1-mini",
): SupplierSearchResult {
  const reason = originalLink.trim()
    ? `La referencia original tiene el valor "${originalLink.trim()}" y se marco como no utilizable.`
    : "La referencia original esta vacia.";

  return {
    summary:
      "Producto omitido: no se gasto busqueda con IA porque no tiene un enlace original valido para identificarlo.",
    warnings: [
      reason,
      "Corrige la columna LINKS ORIGINAL y vuelve a buscar esta fila si quieres alternativas.",
    ],
    candidates: [],
  };
}

function pickRequestedUnits(totalUnitsText: string) {
  const quantities = extractNumbers(totalUnitsText);
  if (!quantities.length) return undefined;
  return Math.max(1, Math.round(quantities[0]));
}

function pickMinimumOrder(minimumOrderText: string) {
  const quantities = extractNumbers(minimumOrderText);
  if (!quantities.length) return undefined;

  // En textos tipo "100-500 pieces" conviene usar la cantidad minima visible.
  return Math.max(1, Math.round(Math.min(...quantities)));
}

function quantityScoreFromRatio(ratio: number) {
  if (ratio <= 1) return 100;
  if (ratio <= 1.5) return 85;
  if (ratio <= 3) return 65;
  if (ratio <= 5) return 40;
  if (ratio <= 10) return 20;
  return 5;
}

function rerankByTargetPriceAndQuantity(
  candidates: CandidateResult[],
  targetPriceText: string,
  totalUnitsText: string,
) {
  const targetPrice = extractNumbers(targetPriceText)[0];
  const requestedUnits = pickRequestedUnits(totalUnitsText);

  if (!targetPrice && !requestedUnits) return candidates;

  return candidates
    .map((candidate) => {
      const matches = [...candidate.matches];
      const differences = [...candidate.differences];
      const rationaleNotes: string[] = [];
      let score = candidate.score;
      let priceScore: number | undefined;
      let quantityScore: number | undefined;

      if (targetPrice) {
        const candidatePrice = pickClosestPrice(candidate.listedPrice, targetPrice);

        if (!candidatePrice) {
          priceScore = 45;
          differences.push(
            "No se pudo comparar el precio porque el precio publicado no es visible o no es numerico.",
          );
          rationaleNotes.push(
            `Precio objetivo: ${targetPriceText}. Precio publicado no comparable, por eso se penaliza el puntaje.`,
          );
        } else {
          const differenceRatio = Math.abs(candidatePrice - targetPrice) / targetPrice;
          const direction = candidatePrice > targetPrice ? "por encima" : "por debajo";
          const differencePercent = Math.round(differenceRatio * 100);
          priceScore = priceScoreFromRatio(differenceRatio);
          const priceNote = `Precio comparable aprox. ${candidatePrice}; esta ${differencePercent}% ${direction} del objetivo ${targetPrice}.`;

          if (differenceRatio <= 0.25) {
            matches.push(priceNote);
          } else {
            differences.push(priceNote);
          }
          rationaleNotes.push(priceNote);
        }
      }

      if (requestedUnits) {
        const minimumOrder = pickMinimumOrder(candidate.minimumOrder);

        if (!minimumOrder) {
          quantityScore = 55;
          differences.push(
            "No se pudo comparar la cantidad minima porque el MOQ no es visible o no es numerico.",
          );
          rationaleNotes.push(
            `Cantidad solicitada: ${requestedUnits}. MOQ no comparable, por eso se penaliza moderadamente.`,
          );
        } else {
          const ratio = minimumOrder / requestedUnits;
          quantityScore = quantityScoreFromRatio(ratio);
          const quantityNote =
            minimumOrder <= requestedUnits
              ? `MOQ aprox. ${minimumOrder}, compatible con las ${requestedUnits} unidades solicitadas.`
              : `MOQ aprox. ${minimumOrder}, supera las ${requestedUnits} unidades solicitadas.`;

          if (minimumOrder <= requestedUnits) {
            matches.push(quantityNote);
          } else {
            differences.push(quantityNote);
          }
          rationaleNotes.push(quantityNote);
        }
      }

      if (priceScore !== undefined && quantityScore !== undefined) {
        score = Math.round(candidate.score * 0.45 + priceScore * 0.35 + quantityScore * 0.2);
      } else if (priceScore !== undefined) {
        score = Math.round(candidate.score * 0.55 + priceScore * 0.45);
      } else if (quantityScore !== undefined) {
        score = Math.round(candidate.score * 0.75 + quantityScore * 0.25);
      }

      if (targetPrice) {
        const candidatePrice = pickClosestPrice(candidate.listedPrice, targetPrice);
        if (candidatePrice) {
          const differenceRatio = Math.abs(candidatePrice - targetPrice) / targetPrice;
          if (differenceRatio > 1.5) score = Math.min(score, 45);
          else if (differenceRatio > 0.75) score = Math.min(score, 62);
          else if (differenceRatio > 0.35) score = Math.min(score, 78);
        }
      }

      if (requestedUnits) {
        const minimumOrder = pickMinimumOrder(candidate.minimumOrder);
        if (minimumOrder) {
          const quantityRatio = minimumOrder / requestedUnits;
          if (quantityRatio > 10) score = Math.min(score, 45);
          else if (quantityRatio > 5) score = Math.min(score, 58);
          else if (quantityRatio > 3) score = Math.min(score, 70);
        }
      }

      score = Math.max(0, Math.min(100, score));

      return {
        ...candidate,
        score,
        confidence: confidenceFromScore(score),
        matches: Array.from(new Set(matches)).slice(0, 8),
        differences: Array.from(new Set(differences)).slice(0, 8),
        rationale: `${candidate.rationale} ${rationaleNotes.join(" ")}`.trim(),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar OPENAI_API_KEY en .env.local." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Los datos del producto no son válidos." },
      { status: 400 },
    );
  }

  const product = parsed.data;
  const requestStartedAt = Date.now();
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!hasUsableOriginalLink(product.originalLink)) {
    const result = skippedMissingOriginalLinkResult(
      product.originalLink,
      Date.now() - requestStartedAt,
      model,
    );
    console.log("Proveedor IA search metrics:", result.metrics);
    return NextResponse.json(result);
  }

  if (!product.descriptionEs && !product.descriptionEn && !product.originalLink) {
    return NextResponse.json(
      { error: "La fila no contiene información suficiente para buscar." },
      { status: 400 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      store: false,
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
        },
      ],
      tool_choice: "auto",
      text: {
        format: {
          type: "json_schema",
          name: "supplier_product_candidates",
          strict: true,
          schema: resultSchema,
        },
      },
      input: [
        {
          role: "system",
          content:
            "Eres analista de compras internacionales. Primero analiza el enlace original del producto de referencia y extrae de esa ficha el nombre/titulo real, precio visible, cantidad minima/MOQ visible, detalles tecnicos y cualquier informacion visual disponible de la imagen principal o miniaturas, como color, forma, material aparente, tipo de producto o empaque. Si la imagen no es accesible o no hay datos visibles, dilo como 'No visible' y no inventes. Despues busca productos reales y actualmente visibles solo en Alibaba y Made-in-China. La ficha original pesa mas que las descripciones de la hoja cuando haya conflicto. Compara identidad, funcion, material, dimensiones, especificaciones, aspecto visual, cantidad minima/MOQ y precio. No inventes datos: usa 'No visible' cuando la pagina no los muestre. El precio de la ficha original y/o el precio objetivo son criterios principales: prioriza candidatos con precio unitario visible lo mas cercano posible, idealmente dentro de +/-20%, y con MOQ igual o menor a las unidades solicitadas. Si un candidato supera el precio de referencia por mas de 35%, no debe quedar arriba salvo que no existan opciones mejores. Si supera el precio por mas del 100%, incluyelo solo como alternativa debil y explica la diferencia. Si el MOQ supera mucho las unidades solicitadas, bajalo de prioridad aunque el producto sea similar. Devuelve como maximo cinco candidatos, ordenados por similitud tecnica, similitud visual, cercania de precio y compatibilidad de cantidad minima. Una URL debe apuntar a una ficha concreta del producto, no a una busqueda, categoria, showroom, proveedor o pagina principal. Nunca devuelvas el mismo enlace original como candidato; los candidatos deben ser alternativas distintas. Rechaza enlaces que redirijan a Made-in-China o Alibaba sin mostrar una ficha concreta. Asigna confianza baja si faltan especificaciones decisivas, si el precio no es comparable, si el MOQ no es compatible o si no pudiste confirmar la imagen. El puntaje es una ayuda, no una afirmacion de equivalencia.",
        },
        {
          role: "user",
          content: `Producto de referencia:
- Descripción en español: ${product.descriptionEs || "No disponible"}
- Descripción en inglés: ${product.descriptionEn || "No disponible"}
- Unidades solicitadas: ${product.totalUnits || "No disponible"}
- Precio objetivo: ${product.targetPrice || "No disponible"}
- Enlace original para identificar el producto: ${product.originalLink || "No disponible"}

Proceso requerido para esta prueba:
1. Abre/analiza primero el enlace original y toma de ahi el nombre real del producto, precio visible, MOQ/cantidad minima visible y detalles visibles de la imagen principal si estan disponibles.
2. Usa esos datos del enlace original como referencia principal para buscar alternativas en Alibaba y Made-in-China.
3. Devuelve solamente fichas concretas de producto. No devuelvas paginas de busqueda, categoria, showroom, portada de proveedor ni enlaces que no muestren producto. No incluyas el enlace original dentro de las opciones.
4. Descarta o baja de prioridad las opciones con precio muy lejano al producto original/objetivo o MOQ/cantidad minima muy superior a las unidades solicitadas.
5. En matches/differences explica coincidencias y diferencias verificables, incluyendo si el nombre, precio, MOQ o imagen del enlace original no fueron visibles.`,
        },
      ],
    });

    const result = JSON.parse(response.output_text) as SupplierSearchResult;
    const candidatesBeforeFilter = Array.isArray(result.candidates) ? result.candidates.length : 0;
    result.candidates = Array.isArray(result.candidates)
      ? rerankByTargetPriceAndQuantity(
          result.candidates.filter((candidate) =>
            isAllowedCandidate(candidate) && !isOriginalLinkCandidate(candidate, product.originalLink),
          ),
          product.targetPrice,
          product.totalUnits,
        )
      : [];

    result.metrics = {
      model,
      durationMs: Date.now() - requestStartedAt,
      ...usageToMetrics(response.usage),
      candidatesBeforeFilter,
      candidatesAfterFilter: result.candidates.length,
    };

    console.log("Proveedor IA search metrics:", result.metrics);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido de búsqueda.";
    console.error("OpenAI product search failed:", message);
    return NextResponse.json(
      { error: "No se pudo completar la búsqueda. Revisa la clave, saldo y conexión." },
      { status: 502 },
    );
  }
}
