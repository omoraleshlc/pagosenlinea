import { randomInt } from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { demoPaymentsEnabled } from "@/lib/demo-cards";
import { enviarReciboEmail } from "@/lib/mail";
import {
  guardarPagoCompletado,
  marcarReciboEnviado,
} from "@/lib/pagos-db";
import { generarReciboCajaPdf } from "@/lib/recibo-pdf";
import { verificarFolioCuenta } from "@/lib/sima-folio";

export const runtime = "nodejs";

type Body = {
  folio?: string;
  nacimiento?: string;
  email?: string;
  metodoLabel?: string;
  autorizacion?: string;
  folioPago?: string;
};

function mxn(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

export async function POST(req: NextRequest) {
  if (!demoPaymentsEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        code: "demo_off",
        message: "El cobro demo está apagado en este servidor.",
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
  const email = String(body.email || "").trim();
  const metodoLabel = String(body.metodoLabel || "Tarjeta").trim();
  const autorizacion = String(body.autorizacion || "").trim() || undefined;
  const folioPago =
    String(body.folioPago || "").trim() ||
    `PEL${100000 + randomInt(900000)}`;

  if (!folio || !nacimiento || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json(
      { ok: false, code: "invalid", message: "Datos de pago incompletos." },
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

  const reciboNum = String(900000 + randomInt(99999));
  const lineas = cuenta.cargos.map((c) => ({
    cantidad: 1,
    descripcion: c.concepto,
    importe: c.monto,
  }));

  let pdf: Buffer;
  try {
    pdf = await generarReciboCajaPdf({
      reciboNum,
      folioPago,
      folio: cuenta.folio,
      paciente: cuenta.paciente,
      email,
      metodoLabel,
      autorizacion,
      lineas,
      total: cuenta.total,
    });
  } catch (err) {
    console.error("recibo pdf", err);
    return NextResponse.json(
      {
        ok: false,
        code: "pdf_failed",
        message: "No pudimos generar el recibo PDF.",
      },
      { status: 500 },
    );
  }

  const storageDir = path.join(process.cwd(), "storage", "recibos");
  fs.mkdirSync(storageDir, { recursive: true });
  const pdfName = `recibo_${cuenta.folio}_${reciboNum}.pdf`;
  const pdfPath = path.join(storageDir, pdfName);
  fs.writeFileSync(pdfPath, pdf);

  try {
    await guardarPagoCompletado({
      folio: cuenta.folio,
      metodo: "tarjeta",
      email,
      monto: cuenta.total,
      folioPago,
      autorizacion,
      reciboNum,
      payload: {
        paciente: cuenta.paciente,
        cargos: cuenta.cargos,
        metodoLabel,
        provider: "demo",
        pdfPath: pdfName,
      },
    });
  } catch (err) {
    console.error("guardarPagoCompletado", err);
    return NextResponse.json(
      {
        ok: false,
        code: "db_unavailable",
        message:
          "Se generó el recibo, pero no pudimos guardarlo en la base de desarrollo.",
      },
      { status: 502 },
    );
  }

  const mail = await enviarReciboEmail({
    to: email,
    folio: cuenta.folio,
    reciboNum,
    montoLabel: mxn(cuenta.total),
    pdf,
    filename: pdfName,
  });

  if (mail.ok) {
    try {
      await marcarReciboEnviado(folioPago, {
        messageId: mail.messageId,
        pdfPath: pdfName,
      });
    } catch (err) {
      console.error("marcarReciboEnviado", err);
    }
  }

  return NextResponse.json({
    ok: true,
    estado: "Pagado",
    folio: cuenta.folio,
    paciente: cuenta.paciente,
    total: cuenta.total,
    folioPago,
    reciboNum,
    autorizacion,
    email,
    reciboEnviado: mail.ok,
    mailMessage: mail.ok ? undefined : mail.message,
    pdfUrl: `/api/pago-rapido/recibo?folioPago=${encodeURIComponent(folioPago)}`,
  });
}
