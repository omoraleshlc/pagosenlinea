import { AuthShell } from "@/components/auth-shell";
import { PagoRapidoForm } from "@/components/pago-rapido-form";

export default function PagoRapidoPage() {
  return (
    <AuthShell
      title="Paga con tu folio"
      subtitle="Sin crear cuenta. Ideal si pagas por otra persona o solo una vez."
      wide
    >
      <PagoRapidoForm />
    </AuthShell>
  );
}
