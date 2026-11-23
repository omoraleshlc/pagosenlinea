/**
 * Fictional cards for LAN / pre-prod checkout demos. Not charged.
 *
 * Production leap: set NEXT_PUBLIC_DEMO_PAYMENTS=false (and wire a real
 * card processor). One env flip hides the buttons and disables fake 3DS.
 */
export function demoPaymentsEnabled() {
  const flag = (process.env.NEXT_PUBLIC_DEMO_PAYMENTS || "true").toLowerCase();
  return !(flag === "false" || flag === "0" || flag === "off");
}

export type DemoCard = {
  id: string;
  label: string;
  hint: string;
  numero: string;
  nombre: string;
  vence: string;
  cvv: string;
};

export const DEMO_CARDS: DemoCard[] = [
  {
    id: "ok",
    label: "Pago exitoso",
    hint: "Pago directo sin 3DS (tarjeta …4242)",
    numero: "4242 4242 4242 4242",
    nombre: "PACIENTE DEMO",
    vence: "12/30",
    cvv: "123",
  },
  {
    id: "reject",
    label: "Rechazo banco",
    hint: "Simula fondos insuficientes",
    numero: "4000 0000 0000 0002",
    nombre: "PACIENTE DEMO",
    vence: "12/30",
    cvv: "123",
  },
  {
    id: "expired",
    label: "Tarjeta vencida",
    hint: "Simula fecha de vencimiento inválida",
    numero: "4000 0000 0000 0069",
    nombre: "PACIENTE DEMO",
    vence: "01/20",
    cvv: "123",
  },
  {
    id: "3ds-fail",
    label: "Fallo 3DS",
    hint: "En el reto escribe 000000 tres veces",
    numero: "5555 5555 5555 4444",
    nombre: "PACIENTE DEMO",
    vence: "12/30",
    cvv: "123",
  },
];
