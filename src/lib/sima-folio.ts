import mysql, { RowDataPacket } from "mysql2/promise";

export type FolioCargo = {
  id: string;
  folio: string;
  concepto: string;
  detalle: string;
  monto: number;
  vence: string;
};

export type FolioLookupOk = {
  ok: true;
  folio: string;
  paciente: string;
  cargos: FolioCargo[];
  total: number;
};

export type FolioLookupErr = {
  ok: false;
  code:
    | "invalid_folio"
    | "invalid_birth"
    | "not_found"
    | "birth_mismatch"
    | "no_charges"
    | "db_unavailable";
  message: string;
};

export type FolioLookupResult = FolioLookupOk | FolioLookupErr;

function dbConfigured() {
  return Boolean(
    process.env.SIMA_DB_HOST?.trim() &&
      process.env.SIMA_DB_USER?.trim() &&
      process.env.SIMA_DB_PASSWORD != null &&
      String(process.env.SIMA_DB_PASSWORD).length > 0,
  );
}

async function getPool() {
  return mysql.createPool({
    host: process.env.SIMA_DB_HOST,
    port: Number(process.env.SIMA_DB_PORT || 3306),
    user: process.env.SIMA_DB_USER,
    password: process.env.SIMA_DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 4,
    enableKeepAlive: true,
    // read-only intent; app must not issue writes
  });
}

export function folioCuentaValido(folio: string) {
  // Folio de cuenta/venta SIMA: E externo, I interno, H hospitalización + 7 digits
  return /^[EIH]\d{7}$/i.test(folio.trim());
}

/** Parse Mexico dd/mm/yyyy → Date (local calendar). */
export function parseFechaMx(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

export function enmascararNombre(texto: string) {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) =>
      i === 0 ? p : `${p.charAt(0)}${"*".repeat(Math.max(p.length - 1, 3))}`,
    )
    .join(" ");
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Read-only verification of folio de cuenta/venta + birth date against SIMA on .64.
 * Never writes. Masks patient name in the response.
 */
export async function verificarFolioCuenta(params: {
  folio: string;
  nacimientoMx: string;
}): Promise<FolioLookupResult> {
  const folio = params.folio.trim().toUpperCase();
  if (!folioCuentaValido(folio)) {
    return {
      ok: false,
      code: "invalid_folio",
      message:
        "El folio de cuenta o venta empieza con E, I o H y lleva 7 números.",
    };
  }
  const birth = parseFechaMx(params.nacimientoMx);
  if (!birth) {
    return {
      ok: false,
      code: "invalid_birth",
      message: "Escribe la fecha de nacimiento como dd/mm/aaaa.",
    };
  }
  if (!dbConfigured()) {
    return {
      ok: false,
      code: "db_unavailable",
      message:
        "La verificación de folio no está configurada en el servidor (SIMA_DB_*).",
    };
  }

  const pool = await getPool();
  const birthIso = toIsoDate(birth);

  try {
    const [pacRows] = await pool.query<RowDataPacket[]>(
      `SELECT id_paciente, folioventa, status, tipopaciente, id_expediente,
              nombre_completo
       FROM sima_venta.paciente
       WHERE UPPER(folioventa) = ?
       LIMIT 1`,
      [folio],
    );
    if (!pacRows.length) {
      return {
        ok: false,
        code: "not_found",
        message:
          "No encontramos ese folio de cuenta o venta. Verifica el ticket o acude a caja.",
      };
    }
    const pac = pacRows[0];
    const idExpediente = Number(pac.id_expediente);

    const [expRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(fecha_nacimiento) AS fn,
              primer_nombre, segundo_nombre, apellido_paterno, apellido_materno
       FROM sima_archivo.expediente
       WHERE id_expediente = ?
       LIMIT 1`,
      [idExpediente],
    );
    if (!expRows.length) {
      return {
        ok: false,
        code: "not_found",
        message:
          "No encontramos el expediente ligado a ese folio. Acude a caja.",
      };
    }
    const exp = expRows[0];
    const fn = String(exp.fn || "").slice(0, 10);
    if (fn !== birthIso) {
      return {
        ok: false,
        code: "birth_mismatch",
        message:
          "El folio existe, pero la fecha de nacimiento no coincide. Usa dd/mm/aaaa (día/mes/año).",
      };
    }

    const nombre =
      [exp.primer_nombre, exp.segundo_nombre, exp.apellido_paterno, exp.apellido_materno]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(" ") || String(pac.nombre_completo || "PACIENTE");

    // Pending / open-ish charges for guest pay (particular share)
    const [cargoRows] = await pool.query<RowDataPacket[]>(
      `SELECT keyCAP,
              IFNULL(NULLIF(TRIM(descripcion), ''), 'Cargo pendiente') AS concepto,
              IFNULL(gpoProducto, '') AS detalle,
              ROUND(IFNULL(cantidadParticular, 0), 2) AS monto,
              DATE(CURDATE() + INTERVAL 10 DAY) AS vence
       FROM simaactual.cargosCuentaPaciente
       WHERE (UPPER(folio) = ? OR UPPER(folioVenta) = ?)
         AND IFNULL(cantidadParticular, 0) > 0
         AND LOWER(IFNULL(statusCuenta, '')) NOT IN ('cerrada', 'cancelada')
         AND (
           LOWER(IFNULL(status, '')) IN ('cxc', 'abierta', 'abierto', 'activo', 'pendiente', 'caja')
           OR LOWER(IFNULL(statusCaja, '')) IN ('standby', 'pendiente', 'abierta', 'por pagar')
           OR LOWER(IFNULL(statusCuenta, '')) IN ('abierta', 'abierto', 'activa', 'caja', '')
         )
       ORDER BY keyCAP
       LIMIT 50`,
      [folio, folio],
    );

    // Fallback: if status filters miss (schema variance), still show particular > 0 not closed
    let rows = cargoRows;
    if (!rows.length) {
      const [fallback] = await pool.query<RowDataPacket[]>(
        `SELECT keyCAP,
                IFNULL(NULLIF(TRIM(descripcion), ''), 'Cargo pendiente') AS concepto,
                IFNULL(gpoProducto, '') AS detalle,
                ROUND(IFNULL(cantidadParticular, 0), 2) AS monto,
                DATE(CURDATE() + INTERVAL 10 DAY) AS vence
         FROM simaactual.cargosCuentaPaciente
         WHERE (UPPER(folio) = ? OR UPPER(folioVenta) = ?)
           AND IFNULL(cantidadParticular, 0) > 0
           AND LOWER(IFNULL(statusCuenta, '')) NOT IN ('cerrada', 'cancelada')
           AND LOWER(IFNULL(statusCaja, '')) NOT IN ('pagado', 'cerrada')
         ORDER BY keyCAP
         LIMIT 50`,
        [folio, folio],
      );
      rows = fallback;
    }

    if (!rows.length) {
      return {
        ok: false,
        code: "no_charges",
        message:
          "No hay cargos pendientes por pagar en ese folio. Si crees que hay un saldo, acude a caja.",
      };
    }

    const cargos: FolioCargo[] = rows.map((r) => ({
      id: String(r.keyCAP),
      folio,
      concepto: String(r.concepto),
      detalle: String(r.detalle || ""),
      monto: Number(r.monto),
      vence: String(r.vence).slice(0, 10),
    }));
    const total = cargos.reduce((s, c) => s + c.monto, 0);

    return {
      ok: true,
      folio,
      paciente: enmascararNombre(nombre.toUpperCase()),
      cargos,
      total,
    };
  } catch (err) {
    console.error("verificarFolioCuenta", err);
    return {
      ok: false,
      code: "db_unavailable",
      message:
        "No pudimos consultar el folio en este momento. Intenta de nuevo o acude a caja.",
    };
  } finally {
    await pool.end();
  }
}
