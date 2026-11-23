"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
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
    // Real NextAuth redirect → Google/Microsoft account picker (never a mock).
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
        <header className="login-header">
          <p className="login-brand-mobile">Hospital La Carlota</p>
          <h2>Inicia sesión</h2>
          <p className="login-sub">
            Accede a Pagos en línea con tu cuenta institucional o de correo.
          </p>
        </header>

        <div className="social-stack">
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
            Continuar con Microsoft
          </button>
        </div>

        <div className="divider" role="separator">
          <span>o con correo</span>
        </div>

        <div className="tabs" role="tablist" aria-label="Método de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "password"}
            className={tab === "password" ? "tab active" : "tab"}
            onClick={() => setTab("password")}
          >
            Contraseña
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "code"}
            className={tab === "code" ? "tab active" : "tab"}
            onClick={() => setTab("code")}
          >
            Código por correo
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
              placeholder="nombre@ejemplo.com"
            />
          </label>

          {tab === "password" ? (
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
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
            </label>
          )}

          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Recordarme en este dispositivo</span>
          </label>

          {message ? <p className="form-message">{message}</p> : null}

          <button type="submit" className="btn-primary btn-block">
            {tab === "password" ? "Iniciar sesión" : "Verificar código"}
          </button>
        </form>

        <p className="create-account">
          ¿No tienes cuenta? <a href="/register">Crear cuenta</a>
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
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.3 5.3C39.2 37.3 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M12 1h10v10H12z" />
      <path fill="#7fba00" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}
