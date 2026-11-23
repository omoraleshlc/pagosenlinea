import { NextResponse } from "next/server";
import { verificarFolioCuenta } from "@/lib/sima-folio";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { folio?: string; nacimiento?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_folio", message: "Solicitud inválida." },
      { status: 400 },
    );
  }

  const result = await verificarFolioCuenta({
    folio: String(body.folio || ""),
    nacimientoMx: String(body.nacimiento || ""),
  });

  const status = result.ok
    ? 200
    : result.code === "db_unavailable"
      ? 503
      : 404;

  return NextResponse.json(result, { status: result.ok ? 200 : status });
}
