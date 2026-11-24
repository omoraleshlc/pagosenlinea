# pagosenlinea — agent instructions

Shared for Cursor, Claude Code, and Codex. Keep short; update when constraints change.

## Product

Hospital La Carlota online payments portal (`pagosenlinea`). Standalone from SIMA: use SIMA only as reference for recibo formulas/layout; do not couple runtimes or merge repos.

## Repos and hosts

- GitHub: https://github.com/omoraleshlc/pagosenlinea
- Live Next app: `192.168.1.43` `/home/oamg/pagosenlinea` port `8421` (`https://pagosenlinea.sshlc.org` via VPN)
- Laravel SIMA-formula helpers (reference port): `/home/oamg/dashboard/pagos` on `.43` (reads SIMA DBs RO from `.64`)
- Credentials: `db1.properties` on Ovidio’s Mac and `/home/oamg/db1.properties` on `.43` — never print or commit secrets
- VPN: Tunnelblick **Developer** required for LAN

## Hard rules

- Never write to production MySQL `192.168.1.11` (mysqlmain) unless Ovidio names that host and asks for a write
- No demo payment mode: production-shaped flow (confirm → completar → pagos DB + Nota de Venta PDF + email)
- Real bank charge still needs a card processor (Conekta/etc.); do not invent fake cards/3DS
- Mercado Pago SPEI/OXXO is stashed; do not re-enable without ask
- Do not paste passwords/API keys in chat or git
- Prefer SIMA `cerrar_cuentas` / Nota de Venta patterns for recibo Descripción (e.g. `Tarjeta de crédito (Aut: …, U.Digitos: …) T.Conekta`)

## Stack

- Next.js App Router + NextAuth (Google) on `.43:8421`
- Pagos DB on developer server; PDF receipt email via SMTP (`pagosenlinea@lacarlota.um.edu.mx` — needs Google App Password; account login password fails SMTP)

## Open work (high level)

- Valid Google App Password in Mac/`db1` for receipt email
- Wire real card processor
- Optional: Laravel HTTP API so Next calls SIMA formula services
- Optional: apply paid amounts into SIMA income (only with explicit ask; never casual `.11` writes)

## References in Cursor Project Context

- `docs/project-context.md`
- `preferences.md`
- `internal/laravel-sima-nota-venta.md`
- `internal/demo-recibo-email.md`
