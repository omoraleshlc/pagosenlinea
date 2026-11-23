export type MpMetodo = "spei" | "tienda";

export type MpPendingPayment = {
  ok: true;
  provider: "mercadopago";
  metodo: MpMetodo;
  paymentId: string;
  status: string;
  statusDetail: string;
  monto: number;
  referencia: string;
  banco?: string;
  ticketUrl?: string;
  vence?: string;
  externalReference: string;
};

export type MpError = {
  ok: false;
  code: "mp_unavailable" | "mp_rejected" | "invalid";
  message: string;
};

function paymentMethodId(metodo: MpMetodo) {
  return metodo === "spei" ? "clabe" : "oxxo";
}

function notificationUrl() {
  const base = (
    process.env.NEXTAUTH_URL ||
    process.env.PAYMENTS_PUBLIC_URL ||
    "https://pagosenlinea.sshlc.org"
  ).replace(/\/$/, "");
  return `${base}/api/webhooks/mercadopago`;
}

function mapPayment(data: Record<string, unknown>, metodo: MpMetodo, fallbackMonto: number) {
  const td = (data.transaction_details || {}) as Record<string, unknown>;
  const poi = (data.point_of_interaction || {}) as Record<string, unknown>;
  const poiTx = (poi.transaction_data || {}) as Record<string, unknown>;
  const bankInfo = (poiTx.bank_info || {}) as Record<string, unknown>;
  const collector = (bankInfo.collector || {}) as Record<string, unknown>;

  const referencia = String(
    td.payment_method_reference_id ||
      poiTx.bank_transfer_id ||
      td.acquirer_reference ||
      data.id ||
      "",
  );

  return {
    paymentId: String(data.id),
    status: String(data.status || "pending"),
    statusDetail: String(data.status_detail || ""),
    monto: Number(data.transaction_amount || fallbackMonto),
    referencia,
    banco:
      typeof collector.account_holder_name === "string"
        ? collector.account_holder_name
        : typeof td.financial_institution === "string"
          ? td.financial_institution
          : metodo === "spei"
            ? "STP / SPEI"
            : "OXXO",
    ticketUrl:
      String(poiTx.ticket_url || td.external_resource_url || "").trim() ||
      undefined,
    vence: data.date_of_expiration
      ? String(data.date_of_expiration)
      : undefined,
    externalReference: String(data.external_reference || ""),
  };
}

export async function crearPagoReferencia(params: {
  metodo: MpMetodo;
  monto: number;
  email: string;
  folio: string;
  description: string;
  idempotencyKey: string;
}): Promise<MpPendingPayment | MpError> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      code: "mp_unavailable",
      message: "Mercado Pago no está configurado en este servidor.",
    };
  }
  if (!["spei", "tienda"].includes(params.metodo)) {
    return { ok: false, code: "invalid", message: "Método no soportado." };
  }
  if (!(params.monto > 0) || !/\S+@\S+\.\S+/.test(params.email)) {
    return { ok: false, code: "invalid", message: "Datos de pago incompletos." };
  }

  const externalReference = `pel-${params.folio}-${params.metodo}-${Date.now()}`;
  const body = {
    transaction_amount: Math.round(params.monto * 100) / 100,
    description: params.description.slice(0, 200),
    payment_method_id: paymentMethodId(params.metodo),
    payer: { email: params.email.trim() },
    external_reference: externalReference,
    notification_url: notificationUrl(),
    metadata: {
      folio: params.folio,
      portal: "pagosenlinea",
      metodo: params.metodo,
      env: "lan-dev",
    },
  };

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : "No pudimos generar la referencia de pago.";
    console.error("mercadopago create", res.status, data);
    return { ok: false, code: "mp_rejected", message: msg };
  }

  const mapped = mapPayment(data, params.metodo, params.monto);
  if (!mapped.referencia) {
    return {
      ok: false,
      code: "mp_unavailable",
      message: "Mercado Pago no devolvió referencia. Intenta de nuevo.",
    };
  }

  return {
    ok: true,
    provider: "mercadopago",
    metodo: params.metodo,
    ...mapped,
    externalReference: mapped.externalReference || externalReference,
  };
}

export async function consultarPagoMp(paymentId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.error("mercadopago get", res.status, await res.text());
    return null;
  }
  return (await res.json()) as Record<string, unknown>;
}

export function estadoPortalFromMp(status: string) {
  if (status === "approved") return "Pagado" as const;
  if (status === "pending" || status === "in_process") {
    return "En revisión" as const;
  }
  if (status === "rejected" || status === "cancelled" || status === "refunded") {
    return "Rechazado" as const;
  }
  return "Pendiente" as const;
}
