"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  CARGOS_PENDIENTES,
  Cargo,
  enmascararNombre,
  fechaCorta,
  folioValido,
  mxn,
} from "@/lib/mock-cargos";

type Resultado = {
  paciente: string;
  cargos: Cargo[];
  total: number;
};

/** Mexico display format dd/mm/yyyy with light masking while typing. */
function formatearFechaMx(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

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

export function PagoRapidoForm() {
  const [folio, setFolio] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [intento, setIntento] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [pagoMsg, setPagoMsg] = useState<string | null>(null);

  const folioOk = folioValido(folio);
  const nacimientoOk = fechaMxValida(nacimiento);

  function buscar(event: FormEvent) {
    event.preventDefault();
    setIntento(true);
    setNoEncontrado(false);
    setResultado(null);
    setPagoMsg(null);
    if (!folioOk || !nacimientoOk) return;

    setBuscando(true);
    window.setTimeout(() => {
      const key = folio.trim().toUpperCase();
      const cargos = CARGOS_PENDIENTES.filter((c) => c.folio === key);
      setBuscando(false);
      if (!cargos.length) {
        setNoEncontrado(true);
        return;
      }
      setResultado({
        paciente: enmascararNombre(cargos[0].paciente.toUpperCase()),
        cargos,
        total: cargos.reduce((s, c) => s + c.monto, 0),
      });
    }, 600);
  }

  function limpiar() {
    setResultado(null);
    setNoEncontrado(false);
    setIntento(false);
    setPagoMsg(null);
  }

  if (resultado) {
    return (
      <div className="pago-rapido-result">
        <div className="cuenta-card">
          <div className="cuenta-card-head">
            <p className="cuenta-meta">
              Cuenta {folio.trim().toUpperCase()} · Paciente
            </p>
            <p className="cuenta-paciente">{resultado.paciente}</p>
          </div>
          <ul className="cuenta-cargos">
            {resultado.cargos.map((c) => (
              <li key={c.id}>
                <span className="cargo-info">
                  <span className="cargo-concepto">{c.concepto}</span>
                  <span className="cargo-vence">Vence {fechaCorta(c.vence)}</span>
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
          onClick={() =>
            setPagoMsg(
              "El cobro en línea se habilitará cuando se conecte el procesador de pagos. Tus cargos de demostración ya están listos.",
            )
          }
        >
          Continuar al pago
        </button>

        {pagoMsg ? <p className="form-message">{pagoMsg}</p> : null}

        <p className="info-note">
          Pagando sin cuenta recibirás tu comprobante por correo, pero no verás
          historial. Puedes{" "}
          <Link href="/register">crear tu cuenta</Link> cuando quieras.
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
        <span>Folio de cuenta</span>
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
            El folio empieza con E, I o H y lleva 7 números.
          </span>
        ) : (
          <span className="field-hint">
            Lo encuentras en tu ticket o recibo. Demostración:{" "}
            <span className="mono">E4068527</span>.
          </span>
        )}
      </label>

      <label className="field">
        <span>Fecha de nacimiento del paciente</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="dd/mm/aaaa"
          value={nacimiento}
          onChange={(e) => setNacimiento(formatearFechaMx(e.target.value))}
          maxLength={10}
          required
          aria-describedby="nacimiento-hint"
        />
        {intento && !nacimientoOk ? (
          <span className="field-error">
            Escribe la fecha como dd/mm/aaaa (ejemplo: 15/03/1988).
          </span>
        ) : (
          <span id="nacimiento-hint" className="field-hint">
            Formato México: dd/mm/aaaa
          </span>
        )}
      </label>

      {noEncontrado ? (
        <p className="form-error" role="alert">
          No encontramos cargos pendientes con esos datos. Verifica el folio o
          acude a caja.
        </p>
      ) : null}

      <button type="submit" className="btn-primary btn-block" disabled={buscando}>
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
