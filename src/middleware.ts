import { NextRequest, NextResponse } from "next/server";

/**
 * Keep the unfinished portal off the public internet / search engines.
 * SPEI/OXXO live payments are unrelated — gated by PAYMENTS_LAN_ONLY + MP token.
 * Mercado Pago webhooks must stay reachable from MP's public IPs.
 */
function siteLanOnlyEnabled() {
  const flag = (process.env.SITE_LAN_ONLY || "true").toLowerCase();
  return !(flag === "false" || flag === "0" || flag === "off");
}

function isPrivateIp(ip: string) {
  const v = ip.trim().toLowerCase();
  if (!v || v === "unknown") return false;
  if (v === "::1" || v === "localhost") return true;
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  if (v.startsWith("127.")) return true;
  if (v.startsWith("10.")) return true;
  if (v.startsWith("192.168.")) return true;
  if (v.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(v);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function clientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "";
}

export function middleware(req: NextRequest) {
  if (!siteLanOnlyEnabled()) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (
    path === "/api/webhooks/mercadopago" ||
    path.startsWith("/api/webhooks/mercadopago/")
  ) {
    return NextResponse.next();
  }

  const ip = clientIp(req);
  // Direct LAN hit (no proxy headers): Next often leaves these empty; allow.
  if (!ip) return NextResponse.next();
  if (isPrivateIp(ip)) return NextResponse.next();

  return new NextResponse(
    "Portal disponible solo en la red local del hospital (aún no está publicado).",
    {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
      },
    },
  );
}

export const config = {
  matcher: [
    /*
     * All routes except Next internals / static assets that don't need the gate.
     * robots.txt stays public so crawlers see Disallow.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
