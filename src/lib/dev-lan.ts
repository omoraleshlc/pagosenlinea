import { NextRequest } from "next/server";

/**
 * Mercado Pago SPEI/OXXO — stashed by default (no live MP creates / emails).
 * Re-enable with PAYMENTS_LAN_ONLY=true + MERCADOPAGO_ACCESS_TOKEN on the LAN portal.
 */
export function paymentsLanEnabled() {
  const flag = (process.env.PAYMENTS_LAN_ONLY || "false").toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

export function requestLooksLikeLanPortal(req: NextRequest) {
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!host) return false;
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host === "pagosenlinea.sshlc.org") return true;
  // LAN IP of the app host
  if (host.startsWith("192.168.1.43")) return true;
  return false;
}
