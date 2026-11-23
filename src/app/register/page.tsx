import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="simple-page">
      <div className="simple-card">
        <h1>Crear cuenta</h1>
        <p>
          El registro local se habilitará cuando el backend de cuentas esté
          conectado. Mientras tanto puedes iniciar sesión con Google o Microsoft
          si OAuth está configurado.
        </p>
        <p>
          <Link href="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
