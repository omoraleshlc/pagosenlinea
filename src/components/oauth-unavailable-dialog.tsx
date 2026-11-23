"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  provider: "Google" | "Microsoft";
  open: boolean;
  onClose: () => void;
};

export function OAuthUnavailableDialog({ provider, open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="oauth-dialog-root" role="presentation">
      <button
        type="button"
        className="oauth-dialog-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="oauth-dialog"
      >
        <h2 id={titleId}>Configurar {provider}</h2>
        <p>
          Las credenciales de {provider} no están definidas en este entorno.
          En el host de producción (.43) agrega{" "}
          {provider === "Google"
            ? "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
            : "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET"}{" "}
          y NEXTAUTH_SECRET / NEXTAUTH_URL, luego reinicia la app. No hay
          selector de cuentas de demostración.
        </p>
        <div className="oauth-dialog-actions">
          <button
            ref={closeRef}
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
