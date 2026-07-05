import { NextRequest, NextResponse } from "next/server";

// TODO: devolver el archivo Excel de resultados generado para el job.

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return NextResponse.json({ error: `TODO: implementar /api/download/${jobId}` }, { status: 501 });
}
