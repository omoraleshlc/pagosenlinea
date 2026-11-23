import { NextRequest, NextResponse } from "next/server";
import { paymentsLanEnabled, requestLooksLikeLanPortal } from "@/lib/dev-lan";
import {
  actualizarPagoPorMpId,
  leerPagoPorMpId,
} from "@/lib/pagos-db";
import {
  consultarPagoMp,
  estadoPortalFromMp,
} from "@/lib/mercadopago";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!paymentsLanEnabled() || !requestLooksLikeLanPortal(req)) {
    return NextResponse.json(
      { ok: false, code: "lan_only", message: "Solo red local." },
      { status: 403 },
    );
  }

  const paymentId = new URL(req.url).searchParams.get("paymentId")?.trim();
  if (!paymentId) {
    return NextResponse.json(
      { ok: false, code: "invalid", message: "Falta paymentId." },
      { status: 400 },
    );
  }

  const local = await leerPagoPorMpId(paymentId).catch(() => null);
  const remote = await consultarPagoMp(paymentId);
  if (!remote && !local) {
    return NextResponse.json(
      { ok: false, code: "not_found", message: "Pago no encontrado." },
      { status: 404 },
    );
  }

  const status = String(remote?.status || local?.status || "pending");
  const statusDetail = String(
    remote?.status_detail || local?.statusDetail || "",
  );

  if (remote) {
    await actualizarPagoPorMpId(paymentId, { status, statusDetail }).catch(
      () => undefined,
    );
  }

  const estado = estadoPortalFromMp(status);
  return NextResponse.json({
    ok: true,
    paymentId,
    status,
    statusDetail,
    estado,
    referencia: local?.referencia,
    monto: local?.monto ?? Number(remote?.transaction_amount || 0),
    folio: local?.folio,
    pagado: status === "approved",
  });
}
