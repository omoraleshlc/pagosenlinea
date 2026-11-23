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
  estado: "Pagado" | "En revisión" | "Pendiente" | "Rechazado";
  folioPago: string;
  paymentId?: string;
  monto: number;
  metodoLabel: string;
  autorizacion?: string;
  referencia?: string;
  banco?: string;
  ticketUrl?: string;
  email: string;
  provider?: "demo" | "mercadopago";
};

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
  {
    id: "spei",
    titulo: "Transferencia SPEI",
    desc: "Desde tu banca en línea con CLABE",
    tiempo: "Minutos",
  },
  {
    id: "tienda",
    titulo: "Pago en tienda (OXXO)",
    desc: "Referencia para pagar en efectivo",
    tiempo: "1 a 24 h",
  },
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
  const [tresDS, setTresDS] = useState(false);
  const [codigo3ds, setCodigo3ds] = useState("");
  const [error3ds, setError3ds] = useState("");
  const [intentos3ds, setIntentos3ds] = useState(0);
  const [pagoOk, setPagoOk] = useState<PagoOk | null>(null);
  const [fallo, setFallo] = useState<{
    titulo: string;
    detalle: string;
    metodoLabel: string;
    folioPago: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

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
    setTresDS(false);
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

  function terminarPagoDemo(estado: PagoOk["estado"]) {
    if (!resultado) return;
    setPagoOk({
      estado,
      folioPago: folioPagoNuevo(),
      monto: resultado.total,
      metodoLabel,
      email: email.trim(),
      provider: "demo",
      autorizacion:
        estado === "Pagado"
          ? String(100000 + Math.floor(Math.random() * 900000))
          : undefined,
    });
    setPaso("resultado");
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
    setProcesando(true);
    window.setTimeout(() => {
      setProcesando(false);
      const final = digitos.slice(-4);
      if (final === "0002") {
        rechazar(
          "Tu banco rechazó el pago",
          "Fondos insuficientes o la tarjeta no está habilitada para compras en línea.",
        );
        return;
      }
      if (final === "0069") {
        rechazar(
          "Tu tarjeta está vencida",
          "La fecha de vencimiento ya pasó. Revisa los datos o usa otra tarjeta.",
        );
        return;
      }
      setCodigo3ds("");
      setError3ds("");
      setIntentos3ds(0);
      setTresDS(true);
    }, 900);
  }

  function confirmar3DS() {
    if (codigo3ds.length < 6) return;
    if (codigo3ds === "000000") {
      const next = intentos3ds + 1;
      setIntentos3ds(next);
      setCodigo3ds("");
      if (next >= 3) {
        setTresDS(false);
        rechazar(
          "No pudimos verificar tu identidad",
          "Escribiste un código incorrecto 3 veces. Por seguridad bloqueamos este intento.",
        );
      } else {
        setError3ds(
          `Código incorrecto. Te quedan ${3 - next} ${3 - next === 1 ? "intento" : "intentos"}.`,
        );
      }
      return;
    }
    setError3ds("");
    setTresDS(false);
    setProcesando(true);
    window.setTimeout(() => {
      setProcesando(false);
      terminarPagoDemo("Pagado");
    }, 700);
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

  useEffect(() => {
    if (
      paso !== "resultado" ||
      !pagoOk?.paymentId ||
      pagoOk.provider !== "mercadopago" ||
      pagoOk.estado === "Pagado" ||
      pagoOk.estado === "Rechazado"
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
    return (
      <div className="pago-rapido-result">
        <div className="checkout-result">
          <div
            className={`checkout-result-icon ${pagoOk.estado === "Pagado" ? "ok" : "pending"}`}
          >
            {pagoOk.estado === "Pagado" ? "✓" : "…"}
          </div>
          <h2>
            {pagoOk.estado === "Pagado"
              ? "¡Pago recibido!"
              : pagoOk.estado === "En revisión"
                ? "Estamos esperando tu transferencia"
                : "Referencia generada"}
          </h2>
          <p className="checkout-result-copy">
            {pagoOk.estado === "Pagado"
              ? `Enviamos tu comprobante a ${pagoOk.email}.`
              : pagoOk.estado === "En revisión"
                ? "Se acredita en minutos. Te avisaremos por correo cuando el banco lo confirme."
                : "Paga en tienda con la referencia. Se refleja en tu cuenta de 1 a 24 horas."}
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
          </dl>
          {pagoOk.estado !== "Pagado" && pagoOk.referencia ? (
            <div className="checkout-ref-box">
              <p>
                {pagoOk.metodoLabel === "SPEI"
                  ? "Transfiere el monto exacto a esta CLABE:"
                  : "Muestra esta referencia en caja OXXO:"}
              </p>
              {pagoOk.banco ? (
                <p className="field-hint" style={{ margin: 0 }}>
                  {pagoOk.banco}
                </p>
              ) : null}
              <p className="mono checkout-ref-value">{pagoOk.referencia}</p>
              <button
                type="button"
                className="btn-secondary btn-block"
                onClick={() => copiarTexto(pagoOk.referencia!)}
              >
                {copiado ? "Copiado" : "Copiar referencia"}
              </button>
              {pagoOk.ticketUrl ? (
                <a
                  className="btn-primary btn-block"
                  href={pagoOk.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textAlign: "center", textDecoration: "none" }}
                >
                  Ver instrucciones de pago
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="field-hint">
            {pagoOk.provider === "mercadopago"
              ? pagoOk.estado === "Pagado"
                ? "Pago acreditado en Mercado Pago. La aplicación automática en SIMA sigue pendiente."
                : "Referencia real (CLABE/OXXO). Consultamos el estado cada 15 s; también puedes abrir las instrucciones."
              : "Demostración de tarjeta. SPEI y OXXO usan Mercado Pago real en este servidor."}
          </p>
          <button type="button" className="btn-primary btn-block" onClick={limpiar}>
            Pagar otro folio
          </button>
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
          <button
            type="button"
            className="btn-secondary btn-block"
            onClick={() => {
              setFallo(null);
              setMetodo("spei");
              setPaso("metodo");
            }}
          >
            Pagar con SPEI
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
            <p className="field-hint">
              Demostración: termina en 0002 (rechazo) o 0069 (vencida). En
              producción Conekta tokeniza la tarjeta; el hospital no la guarda.
            </p>
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
            Acepto los{" "}
            <Link href="/register">términos del servicio</Link> y el aviso de
            privacidad de Hospital La Carlota.
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

        {tresDS ? (
          <div className="modal-3ds" role="dialog" aria-modal="true">
            <div className="modal-3ds-card">
              <h3>Verificación 3D Secure</h3>
              <p>
                Tu banco envió un código. En demostración usa cualquier código
                de 6 dígitos distinto de 000000.
              </p>
              <label className="field">
                <span>Código</span>
                <input
                  value={codigo3ds}
                  onChange={(e) =>
                    setCodigo3ds(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="••••••"
                  autoFocus
                />
              </label>
              {error3ds ? (
                <p className="field-error" role="alert">
                  {error3ds}
                </p>
              ) : null}
              <button
                type="button"
                className="btn-primary btn-block"
                disabled={codigo3ds.length < 6}
                onClick={confirmar3DS}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => setTresDS(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (paso === "cuenta" && resultado) {
    return (
      <div className="pago-rapido-result">
        <div className="invitado-banner">
          Estás pagando como invitado: recibirás el comprobante por correo, sin
          historial.{" "}
          <Link href="/register">Crea tu cuenta</Link> si quieres guardar tus
          pagos.
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
          Pagando sin cuenta recibirás tu comprobante por correo, pero no verás
          historial. Puedes <Link href="/register">crear tu cuenta</Link> cuando
          quieras.
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
        ¿Prefieres ver todo en un solo lugar?{" "}
        <Link href="/register">Crea tu cuenta</Link> o{" "}
        <Link href="/login">inicia sesión</Link>.
      </p>
    </form>
  );
}
