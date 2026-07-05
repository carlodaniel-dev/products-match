# Product Matcher (IA) — repo temporal

Bot que lee un Excel de productos, busca alternativas en Alibaba y
MadeInChina, y usa OpenAI (embeddings + GPT-4o) para elegir el mejor match.

Construido con la misma convención del proyecto grande al que se integrará
más adelante: **Next.js (App Router) + TypeScript + shadcn/ui + pnpm**, para
que la migración sea solo mover carpetas.

## Estado actual: entorno configurado, lógica pendiente

Lo que ya está listo:
- Proyecto Next.js + TypeScript + Tailwind funcionando (`pnpm dev` levanta OK).
- shadcn/ui configurado manualmente (`components.json`, `lib/utils.ts`,
  variables de tema en `app/globals.css`) — el CLI de shadcn no pudo
  descargar su registro remoto desde este entorno de desarrollo, así que se
  configuró a mano con el mismo resultado.
- Dependencias instaladas: `playwright`, `openai`, `xlsx`, `uuid`,
  `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`.
- Estructura de carpetas creada:
  - `app/api/upload`, `app/api/status/[jobId]`, `app/api/download/[jobId]` (stubs)
  - `services/excelParser.ts`, `services/scraper.ts`, `services/matcher.ts` (stubs)
  - `lib/jobStore.ts` (stub)
  - `types/product.ts` (tipos ya definidos)
- `Dockerfile` listo para desplegar en Railway/Render (usa la imagen oficial
  de Playwright, necesaria porque el scraping no corre en serverless).
- `.env.example` con `OPENAI_API_KEY`.

Lo que falta (siguiente paso, cuando confirmes): implementar la lógica real
dentro de cada archivo marcado con `// TODO` — parseo de Excel, scraping con
Playwright, matching con OpenAI, y las páginas de UI con shadcn/ui
(`data-table`, `filter-bar`, `status-badge`, etc., igual que en el repo grande).

## Cómo correrlo

```bash
pnpm install
cp .env.example .env   # agrega tu OPENAI_API_KEY real
npx playwright install --with-deps chromium
pnpm dev
```

Abre `http://localhost:3000`.

## Columnas esperadas en el Excel

- `DESCRIPTION NUEVA ESPAÑOL`
- `DESCRIPTION NUEVA INGLES`
- `TOTAL UNIT`
- `PRICE`
- `LINKS ORIGINAL`

## Despliegue

No usar Vercel (serverless, sin soporte para navegador headless). Usar
Railway o Render con el `Dockerfile` incluido.
