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

export function PagoRapidoForm() {
  const [folio, setFolio] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [intento, setIntento] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [pagoMsg, setPagoMsg] = useState<string | null>(null);

  const folioOk = folioValido(folio);

  function buscar(event: FormEvent) {
    event.preventDefault();
    setIntento(true);
    setNoEncontrado(false);
    setResultado(null);
    setPagoMsg(null);
    if (!folioOk || !nacimiento) return;

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
          type="date"
          value={nacimiento}
          onChange={(e) => setNacimiento(e.target.value)}
          required
        />
        {intento && !nacimiento ? (
          <span className="field-error">Indica la fecha de nacimiento.</span>
        ) : null}
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
