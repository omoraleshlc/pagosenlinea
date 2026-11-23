import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { paymentsLanEnabled, requestLooksLikeLanPortal } from "@/lib/dev-lan";
import { crearPagoReferencia } from "@/lib/mercadopago";
import { guardarPagoIntento } from "@/lib/pagos-db";
import { verificarFolioCuenta } from "@/lib/sima-folio";

export const runtime = "nodejs";

type Body = {
  folio?: string;
  nacimiento?: string;
  metodo?: "spei" | "tienda";
  email?: string;
};

export async function POST(req: NextRequest) {
  if (!paymentsLanEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        code: "disabled",
        message:
          "Mercado Pago (SPEI/OXXO) está pausado por ahora. Usa tarjeta o paga en caja.",
      },
      { status: 403 },
    );
  }
  if (!requestLooksLikeLanPortal(req)) {
    return NextResponse.json(
      {
        ok: false,
        code: "lan_only",
        message:
          "Este cobro solo está disponible en la red local (pagosenlinea.sshlc.org / 192.168.1.43).",
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

  const folio = String(body.folio || "").trim().toUpperCase();
  const nacimiento = String(body.nacimiento || "").trim();
  const metodo = body.metodo;
  const email = String(body.email || "").trim();

  if (metodo !== "spei" && metodo !== "tienda") {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid",
        message: "Elige SPEI o pago en tienda (OXXO).",
      },
      { status: 400 },
    );
  }

  const cuenta = await verificarFolioCuenta({
    folio,
    nacimientoMx: nacimiento,
  });
  if (!cuenta.ok) {
    return NextResponse.json(cuenta, { status: 400 });
  }

  const pago = await crearPagoReferencia({
    metodo,
    monto: cuenta.total,
    email,
    folio: cuenta.folio,
    description: `Hospital La Carlota · folio ${cuenta.folio}`,
    idempotencyKey: randomUUID(),
  });

  if (!pago.ok) {
    return NextResponse.json(pago, { status: 502 });
  }

  try {
    await guardarPagoIntento({
      folio: cuenta.folio,
      metodo,
      email,
      monto: pago.monto,
      mpPaymentId: pago.paymentId,
      externalReference: pago.externalReference,
      referencia: pago.referencia,
      status: pago.status,
      statusDetail: pago.statusDetail,
      ticketUrl: pago.ticketUrl,
      banco: pago.banco,
      vence: pago.vence,
      payload: pago,
    });
  } catch (err) {
    console.error("guardarPagoIntento", err);
    return NextResponse.json(
      {
        ok: false,
        code: "db_unavailable",
        message:
          "Se creó el cobro en Mercado Pago, pero no pudimos guardarlo localmente. Conserva el id " +
          pago.paymentId,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    folio: cuenta.folio,
    paciente: cuenta.paciente,
    cargos: cuenta.cargos,
    total: cuenta.total,
    pago: {
      estado: metodo === "spei" ? "En revisión" : "Pendiente",
      folioPago: `MP-${pago.paymentId}`,
      paymentId: pago.paymentId,
      monto: pago.monto,
      metodoLabel: metodo === "spei" ? "SPEI" : "OXXO",
      referencia: pago.referencia,
      banco: pago.banco,
      ticketUrl: pago.ticketUrl,
      vence: pago.vence,
      email,
      provider: "mercadopago",
      status: pago.status,
    },
  });
}
