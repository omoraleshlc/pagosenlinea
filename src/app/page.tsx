import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth-options";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(getAuthOptions());

  if (!session) {
    // Default guest entry: pay with folio (no account)
    redirect("/pago-rapido");
  }

  return (
    <main className="simple-page">
      <div className="simple-card">
        <h1>Pagos en línea</h1>
        <p>
          Sesión iniciada
          {session.user?.email ? ` como ${session.user.email}` : ""}.
        </p>
        <p>
          <Link href="/api/auth/signout">Cerrar sesión</Link>
        </p>
      </div>
    </main>
  );
}
