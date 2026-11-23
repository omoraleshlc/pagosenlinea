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
    connectTimeout: 8000,
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

/** SIMA paciente_dedcoa.id_forma_pago labels (caja “Deducibles y Coaseguros”). */
function etiquetaDedcoa(idFormaPago: number) {
  switch (idFormaPago) {
    case 168:
      return "Pago de coaseguro 1";
    case 169:
      return "Pago de coaseguro 2";
    case 170:
      return "Pago de deducible 1";
    case 171:
      return "Pago de deducible 2";
    case 248:
      return "Pago compartido · copago";
    default:
      return "Coaseguro / deducible / copago";
  }
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
       WHERE folioventa = ?
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
    // mysql2 returns DATE as JS Date — format locally, do not use String(date).slice
    const fnRaw = exp.fn;
    const fn =
      fnRaw instanceof Date
        ? toIsoDate(fnRaw)
        : String(fnRaw || "").slice(0, 10);
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

    const conceptoExpr = `IFNULL(NULLIF(TRIM(descripcionArticulo), ''), IFNULL(NULLIF(TRIM(descripcion), ''), 'Cargo pendiente'))`;
    const openStatus = `
         LOWER(IFNULL(statusCuenta, '')) NOT IN ('cerrada', 'cancelada')
         AND (
           LOWER(IFNULL(status, '')) IN ('cxc', 'abierta', 'abierto', 'activo', 'pendiente', 'caja')
           OR LOWER(IFNULL(statusCaja, '')) IN ('standby', 'pendiente', 'abierta', 'por pagar')
           OR LOWER(IFNULL(statusCuenta, '')) IN ('abierta', 'abierto', 'activa', 'caja', '')
         )`;

    // Pending particular service charges (existing account income / cargos)
    const [cargoRows] = await pool.query<RowDataPacket[]>(
      `SELECT keyCAP,
              ${conceptoExpr} AS concepto,
              IFNULL(gpoProducto, '') AS detalle,
              ROUND(IFNULL(cantidadParticular, 0), 2) AS monto,
              DATE(CURDATE() + INTERVAL 10 DAY) AS vence,
              IFNULL(gpoProducto, '') AS gpoProducto,
              IFNULL(naturaleza, 'C') AS naturaleza
       FROM simaactual.cargosCuentaPaciente
       WHERE (folio = ? OR folioVenta = ?)
         AND IFNULL(naturaleza, 'C') = 'C'
         AND IFNULL(cantidadParticular, 0) > 0
         AND LOWER(CONCAT_WS(' ', descripcion, descripcionArticulo))
             NOT REGEXP 'coaseg|deducib|copago|pago de deducible|pago de coaseguro'
         AND ${openStatus}
       ORDER BY keyCAP
       LIMIT 50`,
      [folio, folio],
    );

    let rows = cargoRows;
    if (!rows.length) {
      const [fallback] = await pool.query<RowDataPacket[]>(
        `SELECT keyCAP,
                ${conceptoExpr} AS concepto,
                IFNULL(gpoProducto, '') AS detalle,
                ROUND(IFNULL(cantidadParticular, 0), 2) AS monto,
                DATE(CURDATE() + INTERVAL 10 DAY) AS vence,
                IFNULL(gpoProducto, '') AS gpoProducto,
                IFNULL(naturaleza, 'C') AS naturaleza
         FROM simaactual.cargosCuentaPaciente
         WHERE (folio = ? OR folioVenta = ?)
           AND IFNULL(naturaleza, 'C') = 'C'
           AND IFNULL(cantidadParticular, 0) > 0
           AND LOWER(CONCAT_WS(' ', descripcion, descripcionArticulo))
               NOT REGEXP 'coaseg|deducib|copago|pago de deducible|pago de coaseguro'
           AND LOWER(IFNULL(statusCuenta, '')) NOT IN ('cerrada', 'cancelada')
           AND LOWER(IFNULL(statusCaja, '')) NOT IN ('pagado', 'cerrada')
         ORDER BY keyCAP
         LIMIT 50`,
        [folio, folio],
      );
      rows = fallback;
    }

    // Active coaseguro / deducible / copago from SIMA caja modal
    // (sima_venta.paciente_dedcoa — same source as “Deducibles y Coaseguros”).
    const idPaciente = Number(pac.id_paciente);
    const [dedcoaRows] = await pool.query<RowDataPacket[]>(
      `SELECT id_paciente_dedcoa, id_forma_pago, ROUND(IFNULL(importe, 0), 2) AS monto, status
       FROM sima_venta.paciente_dedcoa
       WHERE id_paciente = ?
         AND LOWER(IFNULL(status, '')) = 'activo'
         AND IFNULL(importe, 0) > 0
       ORDER BY id_paciente_dedcoa
       LIMIT 20`,
      [idPaciente],
    );
    const venceCoa = toIsoDate(new Date(Date.now() + 10 * 86400000));
    const coaCargos: FolioCargo[] = dedcoaRows.map((r) => ({
      id: `dedcoa-${r.id_paciente_dedcoa}`,
      folio,
      concepto: etiquetaDedcoa(Number(r.id_forma_pago)),
      detalle: "Deducibles y Coaseguros",
      monto: Number(r.monto),
      vence: venceCoa,
    }));

    const cargos: FolioCargo[] = [
      ...rows.map((r) => ({
        id: String(r.keyCAP),
        folio,
        concepto: String(r.concepto),
        detalle: String(r.detalle || ""),
        monto: Number(r.monto),
        vence: String(r.vence).slice(0, 10),
      })),
      ...coaCargos,
    ];

    if (!cargos.length) {
      return {
        ok: false,
        code: "no_charges",
        message:
          "No hay cargos pendientes por pagar en ese folio. Si crees que hay un saldo, acude a caja.",
      };
    }

    const total = Math.round(cargos.reduce((s, c) => s + c.monto, 0) * 100) / 100;

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
