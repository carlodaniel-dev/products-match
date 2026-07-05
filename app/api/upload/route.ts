import { NextRequest, NextResponse } from "next/server";

// TODO: recibir el Excel (multipart/form-data), guardarlo en /uploads,
// parsear con services/excelParser.ts, crear un job con lib/jobStore.ts
// y disparar el procesamiento en background.

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "TODO: implementar /api/upload" }, { status: 501 });
}
