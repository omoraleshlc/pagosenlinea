import { NextRequest } from "next/server";

/**
 * Live SPEI/OXXO (Mercado Pago) for the hospital LAN portal.
 * This is NOT "hide the website from Google" — that is SITE_LAN_ONLY in middleware.
 * When true (default) and a token is set, real CLABE/OXXO creation is allowed
 * for Hosts that look like the LAN portal (see requestLooksLikeLanPortal).
 */
export function paymentsLanEnabled() {
  const flag = (process.env.PAYMENTS_LAN_ONLY || "true").toLowerCase();
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
