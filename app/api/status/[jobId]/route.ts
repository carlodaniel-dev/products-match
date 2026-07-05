import { NextRequest, NextResponse } from "next/server";

// TODO: devolver el estado actual del job (progreso, productos procesados).

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return NextResponse.json({ error: `TODO: implementar /api/status/${jobId}` }, { status: 501 });
}
