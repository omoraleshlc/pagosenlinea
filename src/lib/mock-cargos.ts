/** Demo pending charges — same folios as pagos template mock (reference only). */
export type Cargo = {
  id: string;
  folio: string;
  paciente: string;
  fecha: string;
  concepto: string;
  detalle: string;
  monto: number;
  vence: string;
};

export const CARGOS_PENDIENTES: Cargo[] = [
  {
    id: "C-1",
    folio: "E4068527",
    paciente: "Ana López Martínez",
    fecha: "2026-11-18",
    concepto: "Consulta de cardiología",
    detalle: "Dr. Jorge Salinas · Consultorio 204",
    monto: 850.0,
    vence: "2026-11-28",
  },
  {
    id: "C-2",
    folio: "E4068527",
    paciente: "Ana López Martínez",
    fecha: "2026-11-18",
    concepto: "Electrocardiograma",
    detalle: "Estudios de gabinete",
    monto: 620.0,
    vence: "2026-11-28",
  },
  {
    id: "C-3",
    folio: "I4068508",
    paciente: "Carlos Ruiz López",
    fecha: "2026-11-17",
    concepto: "Laboratorio: biometría hemática y química sanguínea",
    detalle: "Entrega de resultados en línea",
    monto: 1240.5,
    vence: "2026-11-27",
  },
  {
    id: "C-4",
    folio: "H4067990",
    paciente: "Carlos Ruiz López",
    fecha: "2026-11-12",
    concepto: "Hospitalización · coaseguro (20%)",
    detalle: "Habitación 312 · 2 noches",
    monto: 6420.0,
    vence: "2026-11-25",
  },
  {
    id: "C-5",
    folio: "H4067990",
    paciente: "Carlos Ruiz López",
    fecha: "2026-11-12",
    concepto: "Deducible de póliza",
    detalle: "Aseguradora demo · póliza 000-123",
    monto: 3500.0,
    vence: "2026-11-25",
  },
];

export function folioValido(folio: string) {
  return /^[EIH]\d{7}$/i.test(folio.trim());
}

export function enmascararNombre(texto: string) {
  return texto
    .split(" ")
    .map((p, i) =>
      i === 0 ? p : `${p.charAt(0)}${"*".repeat(Math.max(p.length - 1, 3))}`,
    )
    .join(" ");
}

export function mxn(monto: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(monto);
}

export function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
