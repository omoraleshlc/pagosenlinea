import mysql, { RowDataPacket, ResultSetHeader } from "mysql2/promise";

function configured() {
  return Boolean(
    process.env.PAGOS_DB_HOST?.trim() &&
      process.env.PAGOS_DB_USER?.trim() &&
      process.env.PAGOS_DB_PASSWORD != null &&
      String(process.env.PAGOS_DB_PASSWORD).length > 0,
  );
}

export async function getPagosPool() {
  if (!configured()) {
    throw new Error("PAGOS_DB_* not configured");
  }
  return mysql.createPool({
    host: process.env.PAGOS_DB_HOST,
    port: Number(process.env.PAGOS_DB_PORT || 3306),
    user: process.env.PAGOS_DB_USER,
    password: process.env.PAGOS_DB_PASSWORD,
    database: process.env.PAGOS_DB_NAME || "pagos",
    waitForConnections: true,
    connectionLimit: 4,
    enableKeepAlive: true,
    connectTimeout: 8000,
  });
}

export type PagoMetodo = "spei" | "tienda" | "tarjeta";

export type PagoIntento = {
  id: number;
  folio: string;
  metodo: PagoMetodo;
  email: string;
  monto: number;
  mpPaymentId: string;
  externalReference: string;
  referencia: string;
  status: string;
  statusDetail: string | null;
  ticketUrl: string | null;
  banco: string | null;
  vence: string | null;
};

export async function guardarPagoIntento(row: {
  folio: string;
  metodo: PagoMetodo;
  email: string;
  monto: number;
  mpPaymentId: string;
  externalReference: string;
  referencia: string;
  status: string;
  statusDetail?: string;
  ticketUrl?: string;
  banco?: string;
  vence?: string;
  payload?: unknown;
}) {
  const pool = await getPagosPool();
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO pago_intentos
        (folio, metodo, email, monto, mp_payment_id, external_reference, referencia,
         status, status_detail, ticket_url, banco, vence, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         status=VALUES(status),
         status_detail=VALUES(status_detail),
         ticket_url=VALUES(ticket_url),
         updated_at=CURRENT_TIMESTAMP`,
      [
        row.folio,
        row.metodo,
        row.email,
        row.monto,
        row.mpPaymentId,
        row.externalReference,
        row.referencia,
        row.status,
        row.statusDetail || null,
        row.ticketUrl || null,
        row.banco || null,
        row.vence ? row.vence.slice(0, 19).replace("T", " ") : null,
        JSON.stringify(row.payload ?? {}),
      ],
    );
  } finally {
    await pool.end();
  }
}

export async function actualizarPagoPorMpId(
  mpPaymentId: string,
  patch: { status: string; statusDetail?: string },
) {
  const pool = await getPagosPool();
  try {
    await pool.query(
      `UPDATE pago_intentos
       SET status = ?, status_detail = ?, updated_at = CURRENT_TIMESTAMP
       WHERE mp_payment_id = ?`,
      [patch.status, patch.statusDetail || null, mpPaymentId],
    );
  } finally {
    await pool.end();
  }
}

export async function leerPagoPorMpId(
  mpPaymentId: string,
): Promise<PagoIntento | null> {
  const pool = await getPagosPool();
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, folio, metodo, email, monto, mp_payment_id, external_reference,
              referencia, status, status_detail, ticket_url, banco, vence
       FROM pago_intentos WHERE mp_payment_id = ? LIMIT 1`,
      [mpPaymentId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      folio: String(r.folio),
      metodo: r.metodo,
      email: String(r.email),
      monto: Number(r.monto),
      mpPaymentId: String(r.mp_payment_id),
      externalReference: String(r.external_reference),
      referencia: String(r.referencia),
      status: String(r.status),
      statusDetail: r.status_detail ? String(r.status_detail) : null,
      ticketUrl: r.ticket_url ? String(r.ticket_url) : null,
      banco: r.banco ? String(r.banco) : null,
      vence: r.vence ? String(r.vence) : null,
    };
  } finally {
    await pool.end();
  }
}

/** Persist a completed portal payment (developer DB) and return insert id. */
export async function guardarPagoCompletado(row: {
  folio: string;
  metodo: PagoMetodo;
  email: string;
  monto: number;
  folioPago: string;
  autorizacion?: string;
  reciboNum: string;
  payload?: unknown;
}) {
  const pool = await getPagosPool();
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO pago_intentos
        (folio, metodo, email, monto, mp_payment_id, external_reference, referencia,
         status, status_detail, ticket_url, banco, vence, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NULL, ?, NULL, CAST(? AS JSON))`,
      [
        row.folio,
        row.metodo,
        row.email,
        row.monto,
        row.folioPago,
        `pel-${row.folio}-${row.folioPago}`,
        row.reciboNum,
        row.autorizacion || "portal_ok",
        row.metodo === "tarjeta" ? "Pagos en línea" : null,
        JSON.stringify({
          ...(typeof row.payload === "object" && row.payload
            ? row.payload
            : {}),
          reciboNum: row.reciboNum,
          emailed: false,
        }),
      ],
    );
    return Number(result.insertId);
  } finally {
    await pool.end();
  }
}

export async function marcarReciboEnviado(
  folioPago: string,
  patch: { messageId?: string; pdfPath?: string },
) {
  const pool = await getPagosPool();
  try {
    await pool.query(
      `UPDATE pago_intentos
       SET payload_json = JSON_SET(
             COALESCE(payload_json, JSON_OBJECT()),
             '$.emailed', true,
             '$.messageId', CAST(? AS JSON),
             '$.pdfPath', CAST(? AS JSON),
             '$.emailedAt', CAST(? AS JSON)
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE mp_payment_id = ?`,
      [
        JSON.stringify(patch.messageId || null),
        JSON.stringify(patch.pdfPath || null),
        JSON.stringify(new Date().toISOString()),
        folioPago,
      ],
    );
  } finally {
    await pool.end();
  }
}
