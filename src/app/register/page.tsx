import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="simple-page">
      <div className="simple-card">
        <h1>Crear cuenta</h1>
        <p>
          El registro local se habilitará cuando el backend de cuentas esté
          conectado. No hace falta crear cuenta para pagar: usa{" "}
          <Link href="/pago-rapido">pago rápido</Link> y descarga tu recibo al
          confirmar.
        </p>
        <p>
          <Link href="/pago-rapido">Ir a pago rápido</Link>
          {" · "}
          <Link href="/login">Iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
