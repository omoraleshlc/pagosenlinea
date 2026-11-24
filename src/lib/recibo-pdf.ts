import fs from "fs";
import path from "path";

/** One row in the Nota de Venta detail table (Cargos | Abonos). */
export type ReciboLinea = {
  cantidad: number;
  descripcion: string;
  /** Amount in Cargos column (charges). */
  cargo?: number;
  /** Amount in Abonos column (payments / credits). */
  abono?: number;
  /** @deprecated Prefer cargo/abono; treated as abono when set alone. */
  importe?: number;
};

export type ReciboData = {
  reciboNum: string;
  folioPago: string;
  folio: string;
  paciente: string;
  email: string;
  metodoLabel: string;
  autorizacion?: string;
  lineas: ReciboLinea[];
  total: number;
  fecha?: Date;
  seguro?: string;
  titular?: string;
  expediente?: string;
  caja?: string;
  corte?: string;
  usuario?: string;
  depto?: string;
  razonSocial?: string;
  entidad?: string;
  /** SIMA cat_cajas.terminal — shown as `T.{terminal}` on card lines. */
  terminal?: string;
  subtotal?: number;
  iva?: number;
};

export type FormaPagoPortal = "tarjeta" | "spei" | "tienda";

/**
 * Label from `sima_sat.c_forma_pago.descripcion` for portal methods
 * (same catalog `cerrar_cuentas` joins in CajaDaoImpl).
 */
export function formaPagoDescripcion(
  metodo: FormaPagoPortal | string,
): string {
  switch (metodo) {
    case "tarjeta":
      return "Tarjeta de crédito"; // forma_pago 04
    case "spei":
      return "Transferencia electrónica de fondos"; // forma_pago 03
    case "tienda":
      return "Efectivo"; // forma_pago 01
    default:
      return String(metodo || "Abono").trim() || "Abono";
  }
}

/**
 * Payment Descripción as built in SIMA caja `cerrar_cuentas` (CajaDaoImpl):
 * `{c_forma_pago.descripcion} (Aut: {auth}, U.Digitos: {last4}) T.{terminal}`
 * for card formas 04/08/28/… — matches Nota de Venta Abonos lines.
 */
export function descripcionLineaAbonoSima(opts: {
  metodo: FormaPagoPortal | string;
  concepto?: string;
  folio?: string;
  metodoLabel?: string;
  autorizacion?: string;
  ultimosDigitos?: string;
  terminal?: string;
}): string {
  const forma = formaPagoDescripcion(opts.metodo);
  if (opts.metodo !== "tarjeta") {
    return forma;
  }
  const digits =
    String(opts.ultimosDigitos || "").replace(/\D/g, "").slice(-4) ||
    String(opts.metodoLabel || "").match(/(\d{4})\s*$/)?.[1] ||
    "0000";
  const aut = String(opts.autorizacion || "").trim() || "0";
  const terminal =
    String(opts.terminal || "PEL").replace(/^T\./i, "").trim() || "PEL";
  // Exact CajaDaoImpl cerrar_cuentas string (formas 04/08/28/…):
  // descripcion + ",  (Aut: …, U.Digitos: …), T." + catCajas.terminal
  return `${forma},  (Aut: ${aut}, U.Digitos: ${digits}), T.${terminal}`;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function importeSima(n: number) {
  return `$ ${fmtMoney(n)}`;
}

function triTexto(n: number): string {
  const centenas = Math.floor(n / 100);
  const decenas = Math.floor((n % 100) / 10);
  const unidades = n % 10;
  let result = "";

  switch (centenas) {
    case 1:
      if (decenas === 0 && unidades === 0) return "Cien ";
      result += "Ciento ";
      break;
    case 2:
      result += "Doscientos ";
      break;
    case 3:
      result += "Trescientos ";
      break;
    case 4:
      result += "Cuatrocientos ";
      break;
    case 5:
      result += "Quinientos ";
      break;
    case 6:
      result += "Seiscientos ";
      break;
    case 7:
      result += "Setecientos ";
      break;
    case 8:
      result += "Ochocientos ";
      break;
    case 9:
      result += "Novecientos ";
      break;
  }

  switch (decenas) {
    case 1:
      switch (unidades) {
        case 0:
          return result + "Diez ";
        case 1:
          return result + "Once ";
        case 2:
          return result + "Doce ";
        case 3:
          return result + "Trece ";
        case 4:
          return result + "Catorce ";
        case 5:
          return result + "Quince ";
        default:
          result += "Dieci";
          break;
      }
      break;
    case 2:
      if (unidades === 0) return result + "Veinte ";
      result += "Veinti";
      break;
    case 3:
      result += "Treinta ";
      break;
    case 4:
      result += "Cuarenta ";
      break;
    case 5:
      result += "Cincuenta ";
      break;
    case 6:
      result += "Sesenta ";
      break;
    case 7:
      result += "Setenta ";
      break;
    case 8:
      result += "Ochenta ";
      break;
    case 9:
      result += "Noventa ";
      break;
  }

  if (decenas > 2 && unidades > 0) result += "y ";

  switch (unidades) {
    case 1:
      result += "Un ";
      break;
    case 2:
      result += "Dos ";
      break;
    case 3:
      result += "Tres ";
      break;
    case 4:
      result += "Cuatro ";
      break;
    case 5:
      result += "Cinco ";
      break;
    case 6:
      result += "Seis ";
      break;
    case 7:
      result += "Siete ";
      break;
    case 8:
      result += "Ocho ";
      break;
    case 9:
      result += "Nueve ";
      break;
  }
  return result;
}

/** Port of SIMA `Numero_Letras.cantidadConLetra`. */
export function cantidadConLetra(amount: number): string {
  const abs = Math.abs(amount);
  const parteEntera = Math.floor(abs);
  const centavos = Math.round((abs - parteEntera) * 100);
  const triUnidades = parteEntera % 1000;
  const triMiles = Math.floor(parteEntera / 1000) % 1000;
  const triMillones = Math.floor(parteEntera / 1000000) % 1000;
  const triMilMillones = Math.floor(parteEntera / 1000000000) % 1000;

  let result = "";
  if (parteEntera === 0) {
    return `**Cero  pesos ${String(centavos).padStart(2, "0")}/100 M.N.***`;
  }
  if (triMilMillones > 0) result += triTexto(triMilMillones) + "Mil ";
  if (triMillones > 0) result += triTexto(triMillones);
  if (triMilMillones === 0 && triMillones === 1) result += "Millón ";
  else if (triMilMillones > 0 || triMillones > 0) result += "Millones ";
  if (triMiles > 0) result += triTexto(triMiles) + "Mil ";
  if (triUnidades > 0) result += triTexto(triUnidades);

  const cc = String(centavos).padStart(2, "0");
  return `**${result}pesos ${cc}/100 M.N.**`;
}

function normalizeLinea(l: ReciboLinea): {
  cantidad: number;
  descripcion: string;
  cargo: number;
  abono: number;
} {
  const cargo = Number(l.cargo || 0);
  let abono = Number(l.abono || 0);
  if (!cargo && !abono && l.importe != null) {
    abono = Number(l.importe);
  }
  return {
    cantidad: l.cantidad || 1,
    descripcion: l.descripcion,
    cargo,
    abono,
  };
}

/**
 * A5 Nota de Venta layout aligned with SIMA `cerrar_cuentas` →
 * `createPDF_transaccion_blob` (Cantidad | Descripcion | Cargos | Abonos).
 */
export async function generarReciboCajaPdf(
  data: ReciboData,
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const fecha = data.fecha || new Date();
  const logoPath = path.join(
    process.cwd(),
    "public",
    "images",
    "brand",
    "logo-color.png",
  );
  const razonSocial = data.razonSocial || "HOSPITAL LA CARLOTA";
  const entidad = data.entidad || "Servicios Hospitalarios";
  const seguro = data.seguro || "Particular";
  const caja = data.caja || "PEL";
  const usuario = data.usuario || "portal";
  const depto = data.depto || "Caja";

  const fechaStr = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Monterrey",
  })
    .format(fecha)
    .replace(/\//g, "-");
  const horaStr = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Monterrey",
  }).format(fecha);

  const lineas = (data.lineas.length ? data.lineas : []).map(normalizeLinea);
  const sumCargos = lineas.reduce((s, l) => s + l.cargo, 0);
  const sumAbonos = lineas.reduce((s, l) => s + l.abono, 0);
  const total = data.total || sumCargos || sumAbonos;
  const subtotal = data.subtotal != null ? data.subtotal : total;
  const iva = data.iva != null ? data.iva : 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      margin: 20,
      info: {
        Title: "Nota de Venta",
        Author: "Hospital La Carlota",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageW - doc.page.margins.right;
    const contentW = right - left;

    const headerTop = 18;
    let logoRight = left;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, left, headerTop, { width: 92, height: 36 });
        logoRight = left + 98;
      } catch {
        /* optional */
      }
    }

    const titleX = logoRight;
    const titleW = Math.max(120, contentW * 0.48 - (logoRight - left));
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#000")
      .text(razonSocial, titleX, headerTop + 2, {
        width: titleW,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(7)
      .text(entidad, titleX, headerTop + 14, { width: titleW, align: "center" })
      .text("Nota de Venta", titleX, headerTop + 24, {
        width: titleW,
        align: "center",
      });

    const metaX = left + contentW * 0.58;
    const metaLabelW = 58;
    const metaValX = metaX + metaLabelW;
    const metaValW = right - metaValX;
    let my = headerTop;

    const metaPair = (label: string, value: string, boldValue = false) => {
      doc.font("Helvetica").fontSize(7).fillColor("#000");
      doc.text(label, metaX, my, { width: metaLabelW, lineBreak: false });
      doc.font(boldValue ? "Helvetica-Bold" : "Helvetica");
      doc.text(value, metaValX, my, { width: metaValW, lineBreak: false });
      my += 10;
    };

    metaPair("Recibo", String(data.reciboNum), true);
    metaPair("Fecha", fechaStr);
    metaPair("Hora", horaStr);
    metaPair("Caja", caja);
    metaPair("Departamento", depto.slice(0, 10));
    metaPair("Cajero", usuario);

    let y = Math.max(headerTop + 48, my + 6);
    const labW = 48;
    const valX = left + labW;
    const valW = contentW - labW;

    const patientRow = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(7).fillColor("#000");
      doc.text(label, left, y, { width: labW, lineBreak: false });
      const h = Math.max(
        10,
        doc.heightOfString(value || "", { width: valW }),
      );
      doc.text(value || "", valX, y, { width: valW });
      y += h + 1;
    };

    patientRow("Paciente", data.paciente);
    patientRow("Seguro", seguro);
    patientRow("Ref.", data.folio);
    patientRow("Alta", usuario);

    y += 10;

    // Cantidad | Descripcion | Cargos | Abonos  (SIMA widths ~2,12,2.5,2.5)
    const colCantW = contentW * (2 / 19);
    const colDescW = contentW * (12 / 19);
    const colCargoW = contentW * (2.5 / 19);
    const colAbonoW = contentW - colCantW - colDescW - colCargoW;
    const colCant = left;
    const colDesc = colCant + colCantW;
    const colCargo = colDesc + colDescW;
    const colAbono = colCargo + colCargoW;
    const rowH = 15;

    const vline = (x: number, top: number, h: number) => {
      doc
        .moveTo(x, top)
        .lineTo(x, top + h)
        .stroke();
    };

    const drawGrid = (
      top: number,
      height: number,
      opts: { top?: boolean; bottom?: boolean } = {},
    ) => {
      doc.strokeColor("#000").lineWidth(0.4);
      if (opts.top !== false) {
        doc.moveTo(left, top).lineTo(right, top).stroke();
      }
      if (opts.bottom) {
        doc
          .moveTo(left, top + height)
          .lineTo(right, top + height)
          .stroke();
      }
      vline(left, top, height);
      vline(colDesc, top, height);
      vline(colCargo, top, height);
      vline(colAbono, top, height);
      vline(right, top, height);
    };

    drawGrid(y, rowH, { top: true, bottom: true });
    doc.font("Helvetica").fontSize(7).fillColor("#000");
    doc.text("Cantidad", colCant + 2, y + 4, { width: colCantW - 4 });
    doc.text("Descripcion", colDesc + 3, y + 4, { width: colDescW - 6 });
    doc.text("Cargos", colCargo + 2, y + 4, {
      width: colCargoW - 4,
      align: "right",
    });
    doc.text("Abonos", colAbono + 2, y + 4, {
      width: colAbonoW - 4,
      align: "right",
    });
    y += rowH;

    const rows =
      lineas.length > 0
        ? lineas
        : [
            {
              cantidad: 1,
              descripcion: "Abono",
              cargo: 0,
              abono: total,
            },
          ];

    for (const linea of rows) {
      const descH = Math.max(
        rowH,
        doc.heightOfString(linea.descripcion, { width: colDescW - 8 }) + 8,
      );
      drawGrid(y, descH, { top: false });
      doc.font("Helvetica").fontSize(7);
      doc.text(String(linea.cantidad), colCant + 2, y + 4, {
        width: colCantW - 4,
        align: "center",
      });
      doc.text(linea.descripcion, colDesc + 4, y + 4, {
        width: colDescW - 8,
      });
      doc.text(
        linea.cargo > 0 ? importeSima(linea.cargo) : "",
        colCargo + 2,
        y + 4,
        { width: colCargoW - 4, align: "right" },
      );
      doc.text(
        linea.abono > 0 ? importeSima(linea.abono) : "",
        colAbono + 2,
        y + 4,
        { width: colAbonoW - 4, align: "right" },
      );
      y += descH;
    }

    for (let i = 0; i < 3; i++) {
      drawGrid(y, rowH, { top: false });
      y += rowH;
    }

    // Amount in words (left) + Subtotal/IVA/Total (right) — Nota de Venta style
    const footH = 52;
    doc
      .strokeColor("#000")
      .lineWidth(0.4)
      .rect(left, y, contentW * (14 / 19), footH)
      .stroke();
    doc
      .rect(left + contentW * (14 / 19), y, contentW * (5 / 19), footH)
      .stroke();

    doc.font("Helvetica").fontSize(7).fillColor("#000");
    doc.text(cantidadConLetra(total), left + 6, y + 18, {
      width: contentW * (14 / 19) - 12,
    });

    const totX = left + contentW * (14 / 19) + 4;
    const totW = contentW * (5 / 19) - 8;
    doc.text("Subtotal", totX, y + 8, { width: totW / 2 });
    doc.text(importeSima(subtotal), totX, y + 8, {
      width: totW,
      align: "right",
    });
    doc.text("IVA", totX, y + 20, { width: totW / 2 });
    doc.text(importeSima(iva), totX, y + 20, {
      width: totW,
      align: "right",
    });
    doc.font("Helvetica-Bold");
    doc.text("Total", totX, y + 34, { width: totW / 2 });
    doc.text(importeSima(total), totX, y + 34, {
      width: totW,
      align: "right",
    });
    y += footH + 12;

    doc.font("Helvetica").fontSize(7).fillColor("#000");
    doc.text(
      "Si desea facturar debera hacerlo el mismo dia de la venta.\nhttp://hospitallacarlota.com/aviso-privacidad\nEste documento no es un comprobante CFDI valido",
      left,
      y,
      { width: contentW },
    );

    doc.end();
  });
}
