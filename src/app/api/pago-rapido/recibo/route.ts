import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { leerPagoPorMpId } from "@/lib/pagos-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const folioPago = req.nextUrl.searchParams.get("folioPago")?.trim();
  if (!folioPago) {
    return NextResponse.json(
      { ok: false, message: "Falta folioPago." },
      { status: 400 },
    );
  }

  const row = await leerPagoPorMpId(folioPago);
  if (!row || row.status !== "approved") {
    return NextResponse.json(
      { ok: false, message: "Recibo no encontrado." },
      { status: 404 },
    );
  }

  const pdfName = `recibo_${row.folio}_${row.referencia}.pdf`;
  const pdfPath = path.join(process.cwd(), "storage", "recibos", pdfName);
  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json(
      { ok: false, message: "Archivo PDF no disponible." },
      { status: 404 },
    );
  }

  const buf = fs.readFileSync(pdfPath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
