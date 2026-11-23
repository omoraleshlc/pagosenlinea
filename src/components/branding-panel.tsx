import { AuthGridShape } from "./auth-grid-shape";
import { BrandMark } from "./brand-mark";

const BENEFICIOS = [
  {
    icon: "card",
    texto: "Paga tus cuentas con tarjeta, SPEI o en tienda, sin filas.",
  },
  {
    icon: "file",
    texto: "Solicita y descarga tus facturas CFDI en un clic.",
  },
  {
    icon: "shield",
    texto: "Pagos cifrados. No guardamos el número de tu tarjeta.",
  },
] as const;

function BenefitIcon({ name }: { name: (typeof BENEFICIOS)[number]["icon"] }) {
  if (name === "card") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className="benefit-svg">
        <rect
          x="2"
          y="5"
          width="20"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }
  if (name === "file") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className="benefit-svg">
        <path
          d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="benefit-svg">
      <path
        d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Right brand panel — matches pagos AuthLayout / sima_template. */
export function BrandingPanel() {
  return (
    <aside className="branding-panel" aria-label="Hospital La Carlota">
      <AuthGridShape />
      <div className="branding-content">
        <BrandMark
          variant="wordmark"
          tone="white"
          size="lg"
          href={null}
          appName="Pagos en línea"
        />
        <ul className="branding-benefits">
          {BENEFICIOS.map((b) => (
            <li key={b.texto}>
              <span className="benefit-icon">
                <BenefitIcon name={b.icon} />
              </span>
              <span className="benefit-text">{b.texto}</span>
            </li>
          ))}
        </ul>
        <p className="branding-foot">Pagos en línea · Hospital La Carlota</p>
      </div>
    </aside>
  );
}
