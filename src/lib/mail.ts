import nodemailer from "nodemailer";

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS != null &&
      String(process.env.SMTP_PASS).length > 0,
  );
}

function fromAddress() {
  const from = process.env.SMTP_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER!.trim();
  if (user.includes("@")) return `Pagos en línea <${user}>`;
  const domain = (
    process.env.SMTP_FROM_DOMAIN || "lacarlota.um.edu.mx"
  ).trim();
  return `Pagos en línea <${user}@${domain}>`;
}

function authUser() {
  const user = process.env.SMTP_USER!.trim();
  if (user.includes("@")) return user;
  const domain = (
    process.env.SMTP_FROM_DOMAIN || "lacarlota.um.edu.mx"
  ).trim();
  return `${user}@${domain}`;
}

export async function enviarReciboEmail(params: {
  to: string;
  folio: string;
  reciboNum: string;
  montoLabel: string;
  pdf: Buffer;
  filename: string;
}) {
  if (!smtpConfigured()) {
    return {
      ok: false as const,
      code: "smtp_unconfigured",
      message: "Correo SMTP no configurado en el servidor.",
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: authUser(),
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: fromAddress(),
      to: params.to,
      subject: `Recibo de pago ${params.reciboNum} · Folio ${params.folio}`,
      text: [
        "Hospital La Carlota — Pagos en línea",
        "",
        `Adjuntamos tu recibo de caja ${params.reciboNum}.`,
        `Folio: ${params.folio}`,
        `Monto: ${params.montoLabel}`,
        "",
        "Este mensaje se envió automáticamente desde el portal de pagos.",
      ].join("\n"),
      html: `<p><strong>Hospital La Carlota</strong> — Pagos en línea</p>
<p>Adjuntamos tu <strong>recibo de caja ${params.reciboNum}</strong>.</p>
<p>Folio: ${params.folio}<br/>Monto: ${params.montoLabel}</p>
<p style="color:#666;font-size:12px">Mensaje automático del portal de pagos (servidor de desarrollo).</p>`,
      attachments: [
        {
          filename: params.filename,
          content: params.pdf,
          contentType: "application/pdf",
        },
      ],
    });
    return {
      ok: true as const,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error("smtp send failed", err instanceof Error ? err.message : err);
    return {
      ok: false as const,
      code: "smtp_failed",
      message:
        "No pudimos enviar el recibo por correo. El pago quedó registrado; conserva tu folio.",
    };
  }
}
