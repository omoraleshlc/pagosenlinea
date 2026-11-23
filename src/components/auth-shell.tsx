import { ReactNode } from "react";
import { BrandingPanel } from "./branding-panel";
import { BrandMark } from "./brand-mark";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: ReactNode;
};

/** Matches pagos AuthLayout: form left, brand+logo right. */
export function AuthShell({
  title,
  subtitle,
  wide = false,
  children,
}: AuthShellProps) {
  return (
    <main className="login-shell">
      <div className="login-panel">
        <div className={wide ? "login-panel-inner wide" : "login-panel-inner"}>
          <div className="login-brand-mobile">
            <BrandMark />
          </div>
          <header className="login-header">
            <h1>{title}</h1>
            {subtitle ? <p className="login-sub">{subtitle}</p> : null}
          </header>
          {children}
          <p className="legal-foot">
            Al continuar aceptas los{" "}
            <a href="#terminos">términos del servicio</a> y el{" "}
            <a href="#privacidad">aviso de privacidad</a> del Hospital La
            Carlota.
          </p>
        </div>
      </div>
      <BrandingPanel />
    </main>
  );
}
