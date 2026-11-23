"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { OAuthUnavailableDialog } from "./oauth-unavailable-dialog";

type AuthTab = "password" | "code";
type Provider = "google" | "azure-ad";

type OAuthStatus = {
  google: boolean;
  microsoft: boolean;
};

export function LoginForm() {
  const [tab, setTab] = useState<AuthTab>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [dialogProvider, setDialogProvider] = useState<"Google" | "Microsoft" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data: OAuthStatus) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ google: false, microsoft: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeDialog = useCallback(() => setDialogProvider(null), []);

  async function startOAuth(provider: Provider) {
    const configured =
      provider === "google" ? status?.google : status?.microsoft;
    const label = provider === "google" ? "Google" : "Microsoft";

    if (!configured) {
      setDialogProvider(label);
      return;
    }

    setBusy(true);
    await signIn(provider, { callbackUrl: "/" });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      tab === "password"
        ? "Autenticación por contraseña estará disponible cuando se conecte el backend."
        : "El envío de código por correo estará disponible cuando se conecte el backend.",
    );
  }

  return (
    <div className="login-panel">
      <div className="login-panel-inner">
        <div className="login-brand-mobile">
          <BrandMark />
        </div>

        <header className="login-header">
          <h1>Inicia sesión</h1>
          <p className="login-sub">
            Paga tus cuentas y consulta tus facturas del Hospital La Carlota.
          </p>
        </header>

        <Link href="/pago-rapido" className="btn-primary btn-block folio-first">
          <ReceiptIcon /> Pagar sin cuenta con mi folio
        </Link>
        <p className="folio-first-hint">
          Opción recomendada si pagas una sola vez o por otra persona. Solo
          necesitas el folio y la fecha de nacimiento.
        </p>

        <div className="divider" role="separator">
          <span>o inicia sesión con tu cuenta</span>
        </div>

        <div className="social-stack social-stack-tight">
          <button
            type="button"
            className="btn-social"
            disabled={busy}
            onClick={() => startOAuth("google")}
          >
            <GoogleIcon />
            Continuar con Google
          </button>
          <button
            type="button"
            className="btn-social"
            disabled={busy}
            onClick={() => startOAuth("azure-ad")}
          >
            <MicrosoftIcon />
            Continuar con Microsoft (Outlook, Hotmail)
          </button>
        </div>

        <div className="divider" role="separator">
          <span>o con cualquier correo</span>
        </div>

        <div className="tabs" role="tablist" aria-label="Método de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "password"}
            className={tab === "password" ? "tab active" : "tab"}
            onClick={() => setTab("password")}
          >
            Con contraseña
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "code"}
            className={tab === "code" ? "tab active" : "tab"}
            onClick={() => setTab("code")}
          >
            Con código por correo
          </button>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
          </label>

          {tab === "password" ? (
            <div className="field">
              <div className="field-row">
                <span>Contraseña</span>
                <a href="#" className="field-link" onClick={(e) => e.preventDefault()}>
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          ) : (
            <label className="field">
              <span>Código de verificación</span>
              <input
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código de 6 dígitos"
              />
              <span className="field-hint">
                Te enviamos un código de 6 dígitos. Sin contraseña que recordar.
              </span>
            </label>
          )}

          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Recordarme en este equipo</span>
          </label>

          {message ? <p className="form-message">{message}</p> : null}

          <button type="submit" className="btn-primary btn-block">
            {tab === "password" ? "Iniciar sesión" : "Enviarme un código"}
          </button>
        </form>

        <div className="login-footer-links">
          <p className="create-account">
            ¿Primera vez? <Link href="/register">Crea tu cuenta</Link>
          </p>
        </div>

        <p className="legal-foot">
          Al continuar aceptas los{" "}
          <a href="#terminos">términos del servicio</a> y el{" "}
          <a href="#privacidad">aviso de privacidad</a> del Hospital La Carlota.
        </p>
      </div>

      <OAuthUnavailableDialog
        provider={dialogProvider ?? "Google"}
        open={dialogProvider !== null}
        onClose={closeDialog}
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.0002 13.8619C7.23361 13.8619 4.86803 12.1372 3.92328 9.70241C4.86804 7.26761 7.23361 5.54297 10.0002 5.54297C12.7667 5.54297 15.1323 7.26762 16.0771 9.70243C15.1323 12.1372 12.7667 13.8619 10.0002 13.8619ZM10.0002 4.04297C6.48191 4.04297 3.49489 6.30917 2.4155 9.4593C2.3615 9.61687 2.3615 9.78794 2.41549 9.94552C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C13.5184 15.3619 16.5055 13.0957 17.5849 9.94555C17.6389 9.78797 17.6389 9.6169 17.5849 9.45932C16.5055 6.30919 13.5184 4.04297 10.0002 4.04297ZM9.99151 7.84413C8.96527 7.84413 8.13333 8.67606 8.13333 9.70231C8.13333 10.7286 8.96527 11.5605 9.99151 11.5605H10.0064C11.0326 11.5605 11.8646 10.7286 11.8646 9.70231C11.8646 8.67606 11.0326 7.84413 10.0064 7.84413H9.99151Z"
        fill="#98A2B3"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.63803 3.57709C4.34513 3.2842 3.87026 3.2842 3.57737 3.57709C3.28447 3.86999 3.28447 4.34486 3.57737 4.63775L4.85323 5.91362C3.74609 6.84199 2.89363 8.06395 2.4155 9.45936C2.3615 9.61694 2.3615 9.78801 2.41549 9.94558C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C11.255 15.3619 12.4422 15.0737 13.4994 14.5598L15.3625 16.4229C15.6554 16.7158 16.1302 16.7158 16.4231 16.4229C16.716 16.13 16.716 15.6551 16.4231 15.3622L4.63803 3.57709ZM12.3608 13.4212L10.4475 11.5079C10.3061 11.5423 10.1584 11.5606 10.0064 11.5606H9.99151C8.96527 11.5606 8.13333 10.7286 8.13333 9.70237C8.13333 9.5461 8.15262 9.39434 8.18895 9.24933L5.91885 6.97923C5.03505 7.69015 4.34057 8.62704 3.92328 9.70247C4.86803 12.1373 7.23361 13.8619 10.0002 13.8619C10.8326 13.8619 11.6287 13.7058 12.3608 13.4212ZM16.0771 9.70249C15.7843 10.4569 15.3552 11.1432 14.8199 11.7311L15.8813 12.7925C16.6329 11.9813 17.2187 11.0143 17.5849 9.94561C17.6389 9.78803 17.6389 9.61696 17.5849 9.45938C16.5055 6.30925 13.5184 4.04303 10.0002 4.04303C9.13525 4.04303 8.30244 4.17999 7.52218 4.43338L8.75139 5.66259C9.1556 5.58413 9.57311 5.54303 10.0002 5.54303C12.7667 5.54303 15.1323 7.26768 16.0771 9.70249Z"
        fill="#98A2B3"
      />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
