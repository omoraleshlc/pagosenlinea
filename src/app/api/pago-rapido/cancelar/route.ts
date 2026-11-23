import { NextRequest, NextResponse } from "next/server";
import { paymentsLanEnabled, requestLooksLikeLanPortal } from "@/lib/dev-lan";
import { cancelarPagoMp } from "@/lib/mercadopago";
import {
  actualizarPagoPorMpId,
  leerPagoPorMpId,
} from "@/lib/pagos-db";

export const runtime = "nodejs";

type Body = { paymentId?: string };

export async function POST(req: NextRequest) {
  if (!paymentsLanEnabled() || !requestLooksLikeLanPortal(req)) {
    return NextResponse.json(
      {
        ok: false,
        code: "lan_only",
        message: "Cancelación solo en la red local del portal.",
      },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid", message: "JSON inválido." },
      { status: 400 },
    );
  }

  const paymentId = String(body.paymentId || "").trim();
  if (!paymentId) {
    return NextResponse.json(
      { ok: false, code: "invalid", message: "Falta paymentId." },
      { status: 400 },
    );
  }

  const local = await leerPagoPorMpId(paymentId).catch(() => null);
  if (local && ["approved", "cancelled"].includes(local.status)) {
    return NextResponse.json({
      ok: true,
      paymentId,
      status: local.status,
      estado: local.status === "approved" ? "Pagado" : "Cancelado",
      alreadyFinal: true,
    });
  }

  const cancel = await cancelarPagoMp(paymentId);
  if (!cancel.ok) {
    // If MP already cancelled / not found, still mark local as cancelled when we have a row
    if (local) {
      await actualizarPagoPorMpId(paymentId, {
        status: "cancelled",
        statusDetail: "cancelled_by_user",
      }).catch(() => undefined);
      return NextResponse.json({
        ok: true,
        paymentId,
        status: "cancelled",
        estado: "Cancelado",
        warning: cancel.message,
      });
    }
    return NextResponse.json(cancel, { status: 502 });
  }

  await actualizarPagoPorMpId(paymentId, {
    status: cancel.status,
    statusDetail: "cancelled_by_user",
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    paymentId: cancel.paymentId,
    status: cancel.status,
    estado: "Cancelado",
  });
}
