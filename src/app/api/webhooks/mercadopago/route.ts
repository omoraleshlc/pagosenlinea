import { NextRequest, NextResponse } from "next/server";
import {
  actualizarPagoPorMpId,
  guardarPagoIntento,
  leerPagoPorMpId,
} from "@/lib/pagos-db";
import { consultarPagoMp } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Mercado Pago webhook / IPN.
 * Always re-fetches the payment by id (never trust body alone).
 * Configure in MP dashboard (topic: Payments) →
 * https://pagosenlinea.sshlc.org/api/webhooks/mercadopago
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  let paymentId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";

  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
      id?: string | number;
    };
    if (!paymentId && body?.data?.id != null) paymentId = String(body.data.id);
    if (!paymentId && body?.id != null && body?.type === "payment") {
      paymentId = String(body.id);
    }
  } catch {
    /* empty body IPN still ok via query */
  }

  // Classic IPN: topic=payment&id=
  if (!paymentId && url.searchParams.get("topic") === "payment") {
    paymentId = url.searchParams.get("id") || "";
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const data = await consultarPagoMp(paymentId);
  if (!data) {
    // Acknowledge receipt even if live GET is blocked for this token
    // (personal MP accounts often create payments but cannot read them).
    const existing = await leerPagoPorMpId(paymentId).catch(() => null);
    if (existing) {
      return NextResponse.json({
        ok: true,
        paymentId,
        status: existing.status,
        warning: "mp_get_unauthorized",
      });
    }
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const status = String(data.status || "");
  const statusDetail = String(data.status_detail || "");
  const existing = await leerPagoPorMpId(paymentId).catch(() => null);

  if (existing) {
    await actualizarPagoPorMpId(paymentId, { status, statusDetail });
  } else {
    // late webhook before local insert finished — upsert minimal row
    const td = (data.transaction_details || {}) as Record<string, unknown>;
    const meta = (data.metadata || {}) as Record<string, unknown>;
    await guardarPagoIntento({
      folio: String(meta.folio || "UNKNOWN"),
      metodo: meta.metodo === "tienda" ? "tienda" : "spei",
      email: String((data.payer as { email?: string } | undefined)?.email || ""),
      monto: Number(data.transaction_amount || 0),
      mpPaymentId: paymentId,
      externalReference: String(data.external_reference || `mp-${paymentId}`),
      referencia: String(td.payment_method_reference_id || paymentId),
      status,
      statusDetail,
      payload: data,
    }).catch((err) => console.error("webhook upsert", err));
  }

  return NextResponse.json({ ok: true, paymentId, status });
}

export async function GET(req: NextRequest) {
  // MP sometimes probes with GET
  return POST(req);
}
