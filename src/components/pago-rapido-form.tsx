"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cargo, fechaCorta, folioValido, mxn } from "@/lib/mock-cargos";
import { FechaNacimientoPicker } from "./fecha-nacimiento-picker";

type Resultado = {
  paciente: string;
  cargos: Cargo[];
  total: number;
  folio: string;
};

type Metodo = "tarjeta" | "spei" | "tienda";

type Paso = "buscar" | "cuenta" | "metodo" | "confirmar" | "resultado" | "fallo";

type PagoOk = {
  estado: "Pagado" | "En revisión" | "Pendiente" | "Rechazado" | "Cancelado";
  folioPago: string;
  paymentId?: string;
  monto: number;
  metodoLabel: string;
  autorizacion?: string;
  referencia?: string;
  banco?: string;
  ticketUrl?: string;
  vence?: string;
  email: string;
  provider?: "portal" | "mercadopago";
};

function fechaVenceMx(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Monterrey",
  }).format(d);
}

const METODOS: {
  id: Metodo;
  titulo: string;
  desc: string;
  tiempo: string;
}[] = [
  {
    id: "tarjeta",
    titulo: "Tarjeta de crédito o débito",
    desc: "Visa, Mastercard o American Express",
    tiempo: "Al instante",
  },
  // Mercado Pago SPEI/OXXO stashed — re-add when PAYMENTS_LAN_ONLY is back on.
];

function fechaMxValida(value: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

function folioPagoNuevo() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PEL${n}`;
}

export function PagoRapidoForm() {
  const [folio, setFolio] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [intento, setIntento] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [paso, setPaso] = useState<Paso>("buscar");
  const [metodo, setMetodo] = useState<Metodo>("tarjeta");
  const [email, setEmail] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [tarjeta, setTarjeta] = useState({
    numero: "",
    nombre: "",
    vence: "",
    cvv: "",
  });
  const [procesando, setProcesando] = useState(false);
  const [pagoOk, setPagoOk] = useState<PagoOk | null>(null);
  const [fallo, setFallo] = useState<{
    titulo: string;
    detalle: string;
    metodoLabel: string;
    folioPago: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const folioOk = folioValido(folio);
  const nacimientoOk = fechaMxValida(nacimiento);

  const digitos = tarjeta.numero.replace(/\D/g, "");
  const marca = useMemo(() => {
    if (/^4/.test(digitos)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(digitos)) return "Mastercard";
    if (/^3[47]/.test(digitos)) return "American Express";
    return "";
  }, [digitos]);

  const tarjetaValida =
    digitos.length >= 15 &&
    tarjeta.nombre.trim().length > 3 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(tarjeta.vence) &&
    tarjeta.cvv.length >= 3;

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const metodoLabel =
    metodo === "tarjeta"
      ? `${marca || "Tarjeta"} ···· ${digitos.slice(-4) || "0000"}`
      : metodo === "spei"
        ? "SPEI"
        : "OXXO";

  const puedeConfirmar =
    acepto &&
    emailOk &&
    (metodo !== "tarjeta" || tarjetaValida) &&
    !!resultado;

  async function buscar(event: FormEvent) {
    event.preventDefault();
    setIntento(true);
    setErrorMsg(null);
    setResultado(null);
    setPaso("buscar");
    if (!folioOk || !nacimientoOk) return;

    setBuscando(true);
    try {
      const res = await fetch("/api/pago-rapido/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio: folio.trim().toUpperCase(),
          nacimiento,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrorMsg(
          data.message ||
            "No encontramos cargos pendientes con esos datos. Verifica el folio o acude a caja.",
        );
        return;
      }
      setResultado({
        folio: data.folio,
        paciente: data.paciente,
        cargos: data.cargos,
        total: data.total,
      });
      setPaso("cuenta");
    } catch {
      setErrorMsg(
        "No pudimos consultar el folio en este momento. Intenta de nuevo.",
      );
    } finally {
      setBuscando(false);
    }
  }

  function limpiar() {
    setResultado(null);
    setErrorMsg(null);
    setIntento(false);
    setPaso("buscar");
    setPagoOk(null);
    setFallo(null);
    setAcepto(false);
    setTarjeta({ numero: "", nombre: "", vence: "", cvv: "" });
  }

  function formatearNumero(value: string) {
    const d = value.replace(/\D/g, "").slice(0, 16);
    setTarjeta((t) => ({
      ...t,
      numero: d.replace(/(.{4})/g, "$1 ").trim(),
    }));
  }

  function formatearVence(value: string) {
    const d = value.replace(/\D/g, "").slice(0, 4);
    setTarjeta((t) => ({
      ...t,
      vence: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d,
    }));
  }

  async function completarPagoTarjeta() {
    if (!resultado) return;

    setProcesando(true);
    setErrorMsg(null);
    const folioPago = folioPagoNuevo();
    const autorizacion = String(100000 + Math.floor(Math.random() * 900000));
    try {
      const res = await fetch("/api/pago-rapido/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio: resultado.folio,
          nacimiento,
          email: email.trim(),
          metodoLabel,
          autorizacion,
          folioPago,
          ultimosDigitos: digitos.slice(-4),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        rechazar(
          "El pago no se pudo registrar",
          data.message ||
            "Intenta de nuevo. Si el problema continúa, acude a caja.",
        );
        return;
      }
      setPagoOk({
        estado: "Pagado",
        folioPago: data.folioPago,
        monto: data.total,
        metodoLabel,
        email: data.email,
        provider: "portal",
        autorizacion: data.autorizacion,
        ticketUrl: data.pdfUrl,
        referencia: data.reciboNum ? `Recibo ${data.reciboNum}` : undefined,
        banco: data.reciboEnviado
          ? `Recibo enviado a ${data.email}`
          : data.mailMessage || "Recibo generado (correo pendiente)",
      });
      setPaso("resultado");
    } catch {
      rechazar(
        "No pudimos conectar con el cobro",
        "Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setProcesando(false);
    }
  }

  function rechazar(titulo: string, detalle: string) {
    setFallo({
      titulo,
      detalle,
      metodoLabel,
      folioPago: folioPagoNuevo(),
    });
    setPaso("fallo");
  }

  async function pagarConReferencia() {
    if (!resultado) return;
    setProcesando(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/pago-rapido/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio: resultado.folio,
          nacimiento,
          metodo,
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        rechazar(
          "No pudimos generar la referencia",
          data.message ||
            "Intenta de nuevo o usa otro método de pago.",
        );
        return;
      }
      setPagoOk({
        estado: data.pago.estado,
        folioPago: data.pago.folioPago,
        paymentId: data.pago.paymentId,
        monto: data.pago.monto,
        metodoLabel: data.pago.metodoLabel,
        referencia: data.pago.referencia,
        banco: data.pago.banco,
        ticketUrl: data.pago.ticketUrl,
        vence: data.pago.vence,
        email: data.pago.email,
        provider: "mercadopago",
      });
      setPaso("resultado");
    } catch {
      rechazar(
        "No pudimos conectar con el cobro",
        "Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setProcesando(false);
    }
  }

  function pagar() {
    if (!puedeConfirmar || procesando || !resultado) return;
    if (metodo === "spei" || metodo === "tienda") {
      void pagarConReferencia();
      return;
    }
    void completarPagoTarjeta();
  }

  async function copiarTexto(texto: string) {
    try {
      await navigator.clipboard.writeText(texto.replace(/\s/g, ""));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  }

  const pendienteMp =
    !!pagoOk?.paymentId &&
    pagoOk.provider === "mercadopago" &&
    (pagoOk.estado === "En revisión" || pagoOk.estado === "Pendiente");

  async function cancelarPagoPendiente(next?: "metodo" | "cuenta") {
    if (!pagoOk?.paymentId || !pendienteMp || cancelando) return;
    const ok = window.confirm(
      next === "metodo"
        ? "Vas a elegir otro medio de pago. Cancelaremos esta referencia para que no quede un cobro abierto."
        : "¿Cancelar el pago? La referencia dejará de ser válida y no se cobrará nada.",
    );
    if (!ok) return;
    setCancelando(true);
    try {
      const res = await fetch("/api/pago-rapido/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: pagoOk.paymentId }),
      });
      const data = await res.json();
      if (!data.ok) {
        window.alert(
          data.message ||
            "No pudimos cancelar el pago. Intenta de nuevo o acude a caja.",
        );
        return;
      }
      if (next === "metodo") {
        setPagoOk(null);
        setPaso("metodo");
        return;
      }
      if (next === "cuenta") {
        setPagoOk(null);
        setPaso("cuenta");
        return;
      }
      setPagoOk((prev) =>
        prev ? { ...prev, estado: "Cancelado", ticketUrl: undefined } : prev,
      );
    } catch {
      window.alert("No pudimos cancelar el pago. Intenta de nuevo.");
    } finally {
      setCancelando(false);
    }
  }

  useEffect(() => {
    if (
      paso !== "resultado" ||
      !pagoOk?.paymentId ||
      pagoOk.provider !== "mercadopago" ||
      pagoOk.estado === "Pagado" ||
      pagoOk.estado === "Rechazado" ||
      pagoOk.estado === "Cancelado"
    ) {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/pago-rapido/estado?paymentId=${encodeURIComponent(pagoOk.paymentId!)}`,
        );
        const data = await res.json();
        if (cancelled || !data.ok) return;
        setPagoOk((prev) =>
          prev
            ? {
                ...prev,
                estado: data.estado,
                autorizacion:
                  data.pagado && !prev.autorizacion
                    ? String(data.paymentId)
                    : prev.autorizacion,
              }
            : prev,
        );
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [paso, pagoOk?.paymentId, pagoOk?.provider, pagoOk?.estado]);

  if (paso === "resultado" && pagoOk && resultado) {
    const cancelado = pagoOk.estado === "Cancelado";
    return (
      <div className="pago-rapido-result">
        <div className="checkout-result">
          <div
            className={`checkout-result-icon ${
              pagoOk.estado === "Pagado"
                ? "ok"
                : cancelado
                  ? "err"
                  : "pending"
            }`}
          >
            {pagoOk.estado === "Pagado" ? "✓" : cancelado ? "×" : "…"}
          </div>
          <h2>
            {pagoOk.estado === "Pagado"
              ? "¡Listo, ya recibimos tu pago!"
              : cancelado
                ? "Cancelaste el pago"
                : pagoOk.metodoLabel === "SPEI"
                  ? `Paga ${mxn(pagoOk.monto)} por SPEI`
                  : pagoOk.metodoLabel === "OXXO"
                    ? `Paga ${mxn(pagoOk.monto)} en OXXO`
                    : "Completa tu pago"}
          </h2>
          <p className="checkout-result-copy">
            {pagoOk.estado === "Pagado"
              ? pagoOk.banco ||
                `Registramos tu pago. Recibo disponible para ${pagoOk.email}.`
              : cancelado
                ? "No se cobró nada. Tus cargos siguen pendientes."
                : pagoOk.metodoLabel === "SPEI"
                  ? "Usa la CLABE y el monto exacto. En cuanto se acredite, actualizamos esta pantalla."
                  : "Lleva la referencia a cualquier OXXO. Cuando paguen, lo veremos aquí."}
          </p>
          <dl className="checkout-summary">
            <div>
              <dt>Cuenta</dt>
              <dd>{resultado.folio}</dd>
            </div>
            <div>
              <dt>Folio de pago</dt>
              <dd>{pagoOk.folioPago}</dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{mxn(pagoOk.monto)}</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{pagoOk.metodoLabel}</dd>
            </div>
            <div>
              <dt>{pagoOk.autorizacion ? "Autorización" : "Referencia"}</dt>
              <dd className="mono">
                {pagoOk.autorizacion ?? pagoOk.referencia}
              </dd>
            </div>
            {pagoOk.estado === "Pagado" && pagoOk.referencia ? (
              <div>
                <dt>Recibo</dt>
                <dd>{pagoOk.referencia}</dd>
              </div>
            ) : null}
          </dl>
          {pagoOk.estado === "Pagado" && pagoOk.ticketUrl ? (
            <a
              className="btn-secondary btn-block"
              href={pagoOk.ticketUrl}
              target="_blank"
              rel="noreferrer"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Ver / descargar recibo PDF
            </a>
          ) : null}
          {!cancelado &&
          pagoOk.estado !== "Pagado" &&
          pagoOk.referencia ? (
            <div className="checkout-ref-box">
              <p>
                {pagoOk.metodoLabel === "SPEI"
                  ? "Transfiere el monto exacto a esta CLABE:"
                  : "Paga en OXXO con esta referencia:"}
              </p>
              {pagoOk.banco ? (
                <p className="field-hint" style={{ margin: 0 }}>
                  {pagoOk.banco}
                </p>
              ) : null}
              <p className="mono checkout-ref-value">{pagoOk.referencia}</p>
              {fechaVenceMx(pagoOk.vence) ? (
                <p className="field-hint" style={{ margin: 0 }}>
                  Paga antes del {fechaVenceMx(pagoOk.vence)} (hora Monterrey).
                </p>
              ) : null}
              <button
                type="button"
                className="btn-primary btn-block"
                onClick={() => copiarTexto(pagoOk.referencia!)}
              >
                {copiado ? "Listo, copiado" : "Copiar referencia"}
              </button>
              {pagoOk.ticketUrl ? (
                <a
                  className="btn-secondary btn-block"
                  href={pagoOk.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textAlign: "center", textDecoration: "none" }}
                >
                  Ver ticket de pago
                </a>
              ) : null}
            </div>
          ) : null}

          {pendienteMp ? (
            <>
              <p className="form-message">
                Cuando pagues, confirmamos solo: no cierres ni recargues por
                fuerza. Si sales de esta pantalla, la referencia sigue vigente
                hasta su vencimiento.
              </p>
              <button
                type="button"
                className="btn-secondary btn-block"
                disabled={cancelando}
                onClick={() => void cancelarPagoPendiente("metodo")}
              >
                {cancelando ? "Cancelando…" : "Elegir otro medio de pago"}
              </button>
              <button
                type="button"
                className="link-button"
                disabled={cancelando}
                onClick={() => void cancelarPagoPendiente()}
              >
                Cancelar pago
              </button>
            </>
          ) : null}

          {cancelado ? (
            <>
              <p className="field-hint">
                No se cobró nada. Puedes elegir otro medio o volver a tu cuenta.
              </p>
              <button
                type="button"
                className="btn-primary btn-block"
                onClick={() => {
                  setPagoOk(null);
                  setPaso("metodo");
                }}
              >
                Elegir medio de pago
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setPagoOk(null);
                  setPaso("cuenta");
                }}
              >
                Volver a mi cuenta
              </button>
            </>
          ) : null}

          {pagoOk.estado === "Pagado" ? (
            <button
              type="button"
              className="btn-primary btn-block"
              onClick={limpiar}
            >
              Pagar otro folio
            </button>
          ) : null}

          {!pendienteMp && !cancelado && pagoOk.estado !== "Pagado" ? (
            <button type="button" className="btn-primary btn-block" onClick={limpiar}>
              Pagar otro folio
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (paso === "fallo" && fallo) {
    return (
      <div className="pago-rapido-result">
        <div className="checkout-result">
          <div className="checkout-result-icon err">!</div>
          <h2>{fallo.titulo}</h2>
          <p className="checkout-result-copy">{fallo.detalle}</p>
          <p className="form-message ok">
            No se realizó ningún cobro a {fallo.metodoLabel}.
          </p>
          <p className="field-hint">Folio de intento: {fallo.folioPago}</p>
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={() => {
              setFallo(null);
              setTarjeta((t) => ({ ...t, numero: "", cvv: "" }));
              setPaso("metodo");
            }}
          >
            Intentar con otra tarjeta
          </button>
          <button type="button" className="link-button" onClick={limpiar}>
            Buscar otro folio
          </button>
        </div>
      </div>
    );
  }

  if (paso === "metodo" && resultado) {
    return (
      <div className="pago-rapido-result">
        <p className="checkout-step">Paso 1 de 2 · Método de pago</p>
        <div className="cuenta-card compact">
          <div className="cuenta-card-head">
            <p className="cuenta-meta">
              Cuenta {resultado.folio} · {resultado.paciente}
            </p>
            <p className="cuenta-paciente">{mxn(resultado.total)}</p>
          </div>
        </div>

        <div className="metodo-list" role="radiogroup" aria-label="Método de pago">
          {METODOS.map((m) => (
            <label
              key={m.id}
              className={`metodo-option ${metodo === m.id ? "active" : ""}`}
            >
              <input
                type="radio"
                name="metodo"
                value={m.id}
                checked={metodo === m.id}
                onChange={() => setMetodo(m.id)}
              />
              <span className="metodo-copy">
                <span className="metodo-titulo">{m.titulo}</span>
                <span className="metodo-desc">{m.desc}</span>
              </span>
              <span className="metodo-tiempo">{m.tiempo}</span>
            </label>
          ))}
        </div>

        {metodo === "tarjeta" ? (
          <div className="tarjeta-fields">
            <label className="field">
              <span>Número de tarjeta</span>
              <div className="tarjeta-numero-wrap">
                <input
                  value={tarjeta.numero}
                  onChange={(e) => formatearNumero(e.target.value)}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                />
                {marca ? <span className="tarjeta-marca">{marca}</span> : null}
              </div>
            </label>
            <label className="field">
              <span>Nombre en la tarjeta</span>
              <input
                value={tarjeta.nombre}
                onChange={(e) =>
                  setTarjeta((t) => ({
                    ...t,
                    nombre: e.target.value.toUpperCase(),
                  }))
                }
                autoComplete="cc-name"
                placeholder="NOMBRE APELLIDO"
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Vencimiento</span>
                <input
                  value={tarjeta.vence}
                  onChange={(e) => formatearVence(e.target.value)}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                />
              </label>
              <label className="field">
                <span>CVV</span>
                <input
                  value={tarjeta.cvv}
                  onChange={(e) =>
                    setTarjeta((t) => ({
                      ...t,
                      cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="•••"
                />
              </label>
            </div>
          </div>
        ) : (
          <p className="info-note">
            {metodo === "spei"
              ? "Al confirmar generamos una CLABE real (Mercado Pago / SPEI) para transferir el monto exacto."
              : "Al confirmar generamos una referencia OXXO real (Mercado Pago) para pagar en tienda."}
          </p>
        )}

        <button
          type="button"
          className="btn-primary btn-block"
          disabled={metodo === "tarjeta" && !tarjetaValida}
          onClick={() => setPaso("confirmar")}
        >
          Continuar
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => setPaso("cuenta")}
        >
          Volver a la cuenta
        </button>
      </div>
    );
  }

  if (paso === "confirmar" && resultado) {
    return (
      <div className="pago-rapido-result">
        <p className="checkout-step">Paso 2 de 2 · Confirmar</p>
        <div className="cuenta-card">
          <div className="cuenta-card-head">
            <p className="cuenta-meta">Resumen · {resultado.folio}</p>
            <p className="cuenta-paciente">{resultado.paciente}</p>
          </div>
          <ul className="cuenta-cargos">
            {resultado.cargos.map((c) => (
              <li key={c.id}>
                <span className="cargo-info">
                  <span className="cargo-concepto">{c.concepto}</span>
                </span>
                <span className="cargo-monto">{mxn(c.monto)}</span>
              </li>
            ))}
          </ul>
          <div className="cuenta-total">
            <span>Total · {metodoLabel}</span>
            <strong>{mxn(resultado.total)}</strong>
          </div>
        </div>

        <label className="field">
          <span>Correo para tu comprobante</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
          />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
          />
          <span>
            Acepto los términos del servicio y el{" "}
            <a
              href="https://www.hospitallacarlota.com/aviso-privacidad.html"
              target="_blank"
              rel="noreferrer"
            >
              aviso de privacidad
            </a>{" "}
            de Hospital La Carlota.
          </span>
        </label>

        <button
          type="button"
          className="btn-primary btn-block"
          disabled={!puedeConfirmar || procesando}
          onClick={pagar}
        >
          {procesando ? "Procesando…" : `Pagar ${mxn(resultado.total)}`}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => setPaso("metodo")}
        >
          Cambiar método
        </button>

      </div>
    );
  }

  if (paso === "cuenta" && resultado) {
    return (
      <div className="pago-rapido-result">
        <div className="invitado-banner">
          Estás pagando como invitado: al confirmar generamos tu recibo PDF y lo
          enviamos al correo que indiques.
        </div>
        <div className="cuenta-card">
          <div className="cuenta-card-head">
            <p className="cuenta-meta">
              Cuenta {resultado.folio} · Paciente
            </p>
            <p className="cuenta-paciente">{resultado.paciente}</p>
          </div>
          <ul className="cuenta-cargos">
            {resultado.cargos.map((c) => (
              <li key={c.id}>
                <span className="cargo-info">
                  <span className="cargo-concepto">{c.concepto}</span>
                  <span className="cargo-vence">
                    Vence {fechaCorta(c.vence)}
                  </span>
                </span>
                <span className="cargo-monto">{mxn(c.monto)}</span>
              </li>
            ))}
          </ul>
          <div className="cuenta-total">
            <span>Total a pagar</span>
            <strong>{mxn(resultado.total)}</strong>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary btn-block"
          onClick={() => setPaso("metodo")}
        >
          Continuar al pago
        </button>

        <p className="info-note">
          No necesitas crear cuenta para pagar. El recibo queda registrado en el
          portal de desarrollo y disponible para descargar.
        </p>

        <button type="button" className="link-button" onClick={limpiar}>
          Buscar otro folio
        </button>
      </div>
    );
  }

  return (
    <form className="login-form" noValidate onSubmit={buscar}>
      <label className="field">
        <span>Folio de cuenta o venta</span>
        <input
          value={folio}
          onChange={(e) => setFolio(e.target.value.toUpperCase())}
          autoFocus
          placeholder="Ej. E4068527"
          className="mono"
          autoComplete="off"
        />
        {intento && !folioOk ? (
          <span className="field-error">
            El folio de cuenta o venta empieza con E, I o H y lleva 7 números.
          </span>
        ) : (
          <span className="field-hint">
            Lo encuentras en tu ticket o recibo (folio de cuenta/venta SIMA).
          </span>
        )}
      </label>

      <label className="field">
        <span>Fecha de nacimiento del paciente</span>
        <FechaNacimientoPicker
          id="nacimiento"
          value={nacimiento}
          onChange={setNacimiento}
          aria-describedby="nacimiento-hint"
        />
        {intento && !nacimientoOk ? (
          <span className="field-error">
            Elige o escribe la fecha como dd/mm/aaaa (ejemplo: 08/06/1975).
          </span>
        ) : (
          <span id="nacimiento-hint" className="field-hint">
            Formato México: dd/mm/aaaa (se insertan las / al escribir) o elige en
            el calendario.
          </span>
        )}
      </label>

      {errorMsg ? (
        <p className="form-error" role="alert">
          {errorMsg}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn-primary btn-block"
        disabled={buscando}
      >
        {buscando ? "Buscando…" : "Buscar mi cuenta"}
      </button>

      <p className="create-account">
        ¿Ya tienes acceso al hospital?{" "}
        <Link href="/login">Inicia sesión</Link> (opcional). El pago rápido no
        requiere cuenta.
      </p>
    </form>
  );
}
