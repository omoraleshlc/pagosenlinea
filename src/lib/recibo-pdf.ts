import fs from "fs";
import path from "path";

export type ReciboLinea = {
  cantidad: number;
  descripcion: string;
  importe: number;
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
  /** Optional SIMA-aligned header fields */
  seguro?: string;
  titular?: string;
  expediente?: string;
  caja?: string;
  corte?: string;
  usuario?: string;
  depto?: string;
  razonSocial?: string;
  entidad?: string;
};

export type FormaPagoPortal = "tarjeta" | "spei" | "tienda";

/**
 * Label for the PDF Descripción column — same text SIMA prints from
 * `paciente_transaccion_venta.forma_pago` → `sima_sat.c_forma_pago.descripcion`
 * (PDFformat V3 uses cFormaPago.getDescripcion() when there is no detalle).
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
      return "Efectivo"; // closest SAT/caja label for OXXO (01)
    default:
      return String(metodo || "Abono").trim() || "Abono";
  }
}

/** Single abono line description = type of payment only (PTV forma_pago). */
export function descripcionLineaAbonoSima(opts: {
  metodo: FormaPagoPortal | string;
  concepto?: string;
  folio?: string;
  metodoLabel?: string;
  autorizacion?: string;
}): string {
  return formaPagoDescripcion(opts.metodo);
}

/** SIMA `DecimalFormat("###,###,##0.00")` with `$ ` prefix as on Total. */
function importeSima(n: number) {
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `$ ${body}`;
}

/** Line importe cell: `$` + formatted (SIMA importe_creditoV2). */
function importeLineaSima(n: number) {
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `$${body}`;
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

/** Port of SIMA `Numero_Letras.cantidadConLetra` (words on recibo). */
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

/**
 * A5 Recibo de Caja layout matching SIMA `PDFformat.createPDF_transaccion_blobV3`.
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
  const titular = data.titular || "-";
  const expediente = data.expediente || "-";
  const caja = data.caja || "PEL";
  const corte = data.corte || "-";
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

    // —— Header: logo + titles (left) / recibo meta (right) ——
    const headerTop = 18;
    let logoRight = left;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, left, headerTop, { width: 92, height: 36 });
        logoRight = left + 98;
      } catch {
        /* logo optional */
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
      .text("Recibo de Caja", titleX, headerTop + 24, {
        width: titleW,
        align: "center",
      });

    const metaX = left + contentW * 0.62;
    const metaLabelW = 42;
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
    metaPair("Corte", corte);
    metaPair("Usuario", usuario);

    // —— Patient block (SIMA left labels) ——
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
    patientRow("Titular", titular);
    patientRow("Exp.", expediente);
    patientRow("Ref.", data.folio);
    patientRow("Depto.", depto);

    y += 10;

    // —— Movements table: Cantidad | Descripcion | Importe ——
    const colCant = left;
    const colCantW = contentW * (2 / 18);
    const colDesc = colCant + colCantW;
    const colDescW = contentW * (12 / 18);
    const colImp = colDesc + colDescW;
    const colImpW = contentW - colCantW - colDescW;
    const rowH = 16;

    const drawRowBorder = (
      top: number,
      height: number,
      opts: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean },
    ) => {
      doc.strokeColor("#000").lineWidth(0.4);
      if (opts.top) {
        doc
          .moveTo(left, top)
          .lineTo(right, top)
          .stroke();
      }
      if (opts.bottom) {
        doc
          .moveTo(left, top + height)
          .lineTo(right, top + height)
          .stroke();
      }
      if (opts.left) {
        doc
          .moveTo(left, top)
          .lineTo(left, top + height)
          .stroke();
        doc
          .moveTo(colDesc, top)
          .lineTo(colDesc, top + height)
          .stroke();
      }
      if (opts.right) {
        doc
          .moveTo(colImp, top)
          .lineTo(colImp, top + height)
          .stroke();
        doc
          .moveTo(right, top)
          .lineTo(right, top + height)
          .stroke();
      }
    };

    // Header row
    drawRowBorder(y, rowH, { left: true, right: true, top: true, bottom: true });
    doc.font("Helvetica").fontSize(7).fillColor("#000");
    doc.text("Cantidad", colCant + 3, y + 4, {
      width: colCantW - 6,
      align: "left",
    });
    doc.text("Descripcion", colDesc + 3, y + 4, { width: colDescW - 6 });
    doc.text("Importe", colImp + 3, y + 4, {
      width: colImpW - 6,
      align: "left",
    });
    y += rowH;

    const lineas =
      data.lineas.length > 0
        ? data.lineas
        : [{ cantidad: 1, descripcion: "Abono", importe: data.total }];

    for (const linea of lineas) {
      const descH = Math.max(
        rowH,
        doc.heightOfString(linea.descripcion, { width: colDescW - 8 }) + 8,
      );
      drawRowBorder(y, descH, { left: true, right: true });
      doc.font("Helvetica").fontSize(7);
      doc.text(String(linea.cantidad), colCant + 2, y + 4, {
        width: colCantW - 4,
        align: "center",
      });
      doc.text(linea.descripcion, colDesc + 4, y + 4, {
        width: colDescW - 8,
      });
      doc.text(importeLineaSima(linea.importe), colImp + 2, y + 4, {
        width: colImpW - 6,
        align: "right",
      });
      y += descH;
    }

    // Spacer rows (SIMA pads empty bill rows)
    for (let i = 0; i < 4; i++) {
      drawRowBorder(y, rowH, { left: true, right: true });
      y += rowH;
    }

    // Notes + amount in words (bordered box, colspan visual)
    const notesH = 48;
    doc
      .strokeColor("#000")
      .lineWidth(0.4)
      .rect(left, y, contentW * (14 / 18), notesH)
      .stroke();
    doc
      .rect(left + contentW * (14 / 18), y, contentW * (4 / 18), notesH)
      .stroke();

    doc.font("Helvetica").fontSize(7).fillColor("#000");
    doc.text(
      "Este documento no es un comprobante fiscal",
      left + 6,
      y + 10,
      { width: contentW * (14 / 18) - 12 },
    );
    doc.text(cantidadConLetra(data.total), left + 6, y + 26, {
      width: contentW * (14 / 18) - 12,
    });
    y += notesH;

    // Total row
    const totalH = 18;
    doc
      .strokeColor("#000")
      .lineWidth(0.4)
      .rect(left, y, contentW, totalH)
      .stroke();
    doc.font("Helvetica").fontSize(7);
    doc.text("Total", left + 6, y + 5, { width: 80 });
    doc.text(importeSima(data.total), left + contentW / 2, y + 5, {
      width: contentW / 2 - 8,
      align: "right",
    });
    y += totalH + 12;

    // Footer (SIMA celdas_footer)
    doc.font("Helvetica").fontSize(7).fillColor("#000");
    doc.text(
      "Si desea facturar debera hacerlo el mismo dia de la venta.\nhttp://hospitallacarlota.com/aviso-privacidad",
      left,
      y,
      { width: contentW },
    );

    doc.end();
  });
}
