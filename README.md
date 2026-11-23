# Pagos en línea — Hospital La Carlota

Next.js (App Router) + TypeScript login portal for online payments.
## Standalone

This repository is **independent of SIMA**. No shared SIMA packages, monorepo merge, or hard dependencies. SIMA may be used only as a visual/UX reference.



## UI reference

Login layout follows the existing **sima_template / pagos AuthLayout** (TailAdmin): Hospital La Carlota logos under `public/images/brand/`, brand blue `#214690`, form left / brand panel right. Visual reference only — no SIMA runtime coupling.
## URLs

| Role | URL |
|------|-----|
| LAN app | http://192.168.1.43:8421 |
| Health | http://192.168.1.43:8421/healthz → `{ "ok": true }` |
| LAN hostname | https://pagosenlinea.sshlc.org/ (pre-prod; `SITE_LAN_ONLY` + `robots.txt` / noindex — not for Google yet) |
| Login | https://pagosenlinea.sshlc.org/login |

Access to `.43` / internal ports needs the Tunnelblick **Developer** VPN profile. Live SPEI/OXXO use `PAYMENTS_LAN_ONLY` + Mercado Pago tokens — that flag does **not** mean “hide the website.”

## Scripts

```bash
npm install
npm run dev    # 0.0.0.0:8421
npm run build
npm run start  # 0.0.0.0:8421
```

Copy `.env.example` → `.env.local` (dev) or the host env file on `.43` (prod).

## OAuth (Google required)

This app uses **NextAuth**. There is **no demo / frozen account picker**.

- If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are missing → dismissible dialog (Cerrar, Escape, backdrop).
- If they are set on the deployed host → **Continuar con Google** starts a real Google OAuth redirect and Google’s own account chooser.

Microsoft (Azure AD) works the same when `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` are set.

### Env vars

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_URL` | `https://pagosenlinea.sshlc.org` in production |
| `NEXTAUTH_SECRET` | Session signing secret (generate; do not invent or commit) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Optional Azure AD app ID |
| `MICROSOFT_CLIENT_SECRET` | Optional Azure AD secret |
| `MICROSOFT_TENANT_ID` | Default `common` |

### Google Cloud Console — what Ovidio must add

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create (or edit) an **OAuth 2.0 Client ID** (Web application).
3. **Authorized JavaScript origins**
   - `https://pagosenlinea.sshlc.org`
   - (optional LAN) `http://192.168.1.43:8421`
4. **Authorized redirect URIs** (required)
   - `https://pagosenlinea.sshlc.org/api/auth/callback/google`
   - (optional LAN/dev) `http://192.168.1.43:8421/api/auth/callback/google`
   - (optional local) `http://localhost:8421/api/auth/callback/google`
5. Copy the client ID and secret into the app host env (never into git).

### Where to put secrets (.43 / nginx)

- **App process host `192.168.1.43`**: set `GOOGLE_CLIENT_*`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL=https://pagosenlinea.sshlc.org` in the runtime env used by `npm run start` (systemd unit, process manager, or `.env` next to the deploy — same place other app secrets live). Restart the Node process after changes.
- **Nginx edge `192.168.1.64`**: no OAuth secrets needed there; it only reverse-proxies HTTPS to `.43:8421`. Ensure `pagosenlinea.sshlc.org` proxies `/api/auth/*` to the app unchanged.
- Do **not** put secrets in the GitHub repo or in nginx config files committed to git.

### Microsoft (optional)

Azure Portal → App registrations → Authentication → Web redirect URI:

`https://pagosenlinea.sshlc.org/api/auth/callback/azure-ad`

## Notes

- Production MySQL `192.168.1.11` is out of scope for this seed; do not write to it unless explicitly authorized.
- Public DNS may point at `177.242.144.10`; the portal works publicly only after nginx on `.64` is loaded.
