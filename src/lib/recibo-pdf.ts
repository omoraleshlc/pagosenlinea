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

function mxn(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

/** A5 “Recibo de Caja” layout aligned with SIMA caja receipt fields. */
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

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      margin: 28,
      info: {
        Title: `Recibo ${data.reciboNum}`,
        Author: "Hospital La Carlota · Pagos en línea",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageW - doc.page.margins.right;
    const descWidth = right - left - 36 - 70 - 8;

    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, left, 24, { width: 92 });
      } catch {
        /* logo optional */
      }
    }

    doc
      .fontSize(12)
      .fillColor("#214690")
      .text("Recibo de Caja", left + 100, 28, { width: 160 });
    doc
      .fontSize(8)
      .fillColor("#333")
      .text("Hospital La Carlota", left + 100, 44)
      .text("Camino al vapor #209 Col. Zambrano", left + 100, 54)
      .text("Montemorelos NL · CP 67512", left + 100, 64)
      .text("Tel. (826) 263-3188", left + 100, 74);

    doc
      .fontSize(9)
      .fillColor("#111")
      .text(`Recibo ${data.reciboNum}`, right - 120, 28, {
        width: 120,
        align: "right",
      })
      .fontSize(8)
      .fillColor("#444")
      .text(
        fecha.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "America/Monterrey",
        }),
        right - 120,
        42,
        { width: 120, align: "right" },
      )
      .text(
        fecha.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Monterrey",
        }),
        right - 120,
        52,
        { width: 120, align: "right" },
      )
      .text("Caja: Pagos en línea", right - 120, 62, {
        width: 120,
        align: "right",
      })
      .text("Usuario: portal", right - 120, 72, {
        width: 120,
        align: "right",
      });

    doc
      .moveTo(left, 96)
      .lineTo(right, 96)
      .strokeColor("#ccc")
      .stroke();

    let y = 108;
    const metaRow = (label: string, value: string) => {
      doc.fontSize(8).fillColor("#666").text(label, left, y, { width: 70 });
      const h = Math.max(
        12,
        doc.heightOfString(value || "—", {
          width: right - left - 72,
        }),
      );
      doc
        .fillColor("#111")
        .text(value || "—", left + 72, y, { width: right - left - 72 });
      y += h + 2;
    };

    metaRow("Paciente", data.paciente);
    metaRow("Ref.", data.folio);
    metaRow("Folio pago", data.folioPago);
    metaRow("Método", data.metodoLabel);
    if (data.autorizacion) metaRow("Autorización", data.autorizacion);
    metaRow("Email", data.email);
    metaRow("Depto.", "Pagos en línea");

    y += 8;
    doc
      .fontSize(8)
      .fillColor("#214690")
      .text("Cant.", left, y, { width: 36 })
      .text("Descripción", left + 40, y, { width: descWidth })
      .text("Importe", right - 70, y, { width: 70, align: "right" });
    y += 12;
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#ddd")
      .stroke();
    y += 6;

    for (const linea of data.lineas) {
      doc.fontSize(8).fillColor("#111");
      const descH = Math.max(
        12,
        doc.heightOfString(linea.descripcion, { width: descWidth }),
      );
      const rowH = descH + 4;

      doc.text(String(linea.cantidad), left, y, { width: 36 });
      doc.text(linea.descripcion, left + 40, y, {
        width: descWidth,
        lineGap: 1,
      });
      doc.text(mxn(linea.importe), right - 70, y, {
        width: 70,
        align: "right",
      });
      y += rowH;
    }

    y += 8;
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#ccc")
      .stroke();
    y += 10;
    doc
      .fontSize(10)
      .fillColor("#111")
      .text("Total", left + 40, y)
      .text(mxn(data.total), right - 70, y, { width: 70, align: "right" });

    y += 28;
    doc
      .fontSize(7)
      .fillColor("#666")
      .text(
        "Este documento no es deducible fiscalmente. El ticket para facturación electrónica tiene validez de 60 días.",
        left,
        y,
        { width: right - left },
      )
      .text("www.hospitallacarlota.com/aviso-privacidad.html", left, y + 20);

    doc.end();
  });
}
