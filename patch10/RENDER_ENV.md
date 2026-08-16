# Render environment variables — full checklist

## Required (the API won't work without these)

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Internal Database URL | From your Render Postgres |
| `JWT_ACCESS_SECRET` | 48 random bytes | App **refuses to boot** without it |
| `JWT_REFRESH_SECRET` | 48 random bytes, different | |
| `APP_BASE_URL` | `https://builderos1.vercel.app` | CORS + refresh cookie origin |
| `NODE_ENV` | `production` | Controls `sameSite: none` on the cookie |
| `INGEST_SECRET` | long random string | Guards ingest + diagnostics |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Optional (features degrade honestly without them)

| Key | Effect if missing |
|---|---|
| `RESEND_API_KEY` | Sign-in codes print to the Render log instead of emailing |
| `MAIL_FROM` | Defaults to `onboarding@resend.dev` |
| `VOYAGE_API_KEY` | Ranking uses the lexical fallback; the UI says so |
| `GOAT_RPC_URL` | Defaults to the public `rpc.testnet3.goat.network` |

## CORS: your console is a SECOND origin

`APP_BASE_URL` currently points at the landing page. Your console lives on a
different domain (`builderos3.vercel.app`), and `main.ts` allows exactly one
origin — so console requests may be rejected depending on your setup.

If the console hits CORS errors, allow both. In `apps/api/src/main.ts`:

```ts
const allowedOrigins = [
  process.env.APP_BASE_URL,
  process.env.CONSOLE_BASE_URL,
].filter(Boolean) as string[];

app.enableCors({
  origin: allowedOrigins,
  credentials: true,
});
```

Then add on Render:

```
CONSOLE_BASE_URL = https://builderos3.vercel.app
```

## Vercel — landing project

```
NEXT_PUBLIC_CONSOLE_URL = https://builderos3.vercel.app
```

## Vercel — console project

```
NEXT_PUBLIC_API_URL     = https://builderos-api.onrender.com
NEXT_PUBLIC_LANDING_URL = https://builderos1.vercel.app
```

`NEXT_PUBLIC_*` values are baked in at build time — redeploy after changing
them, or the running build keeps the old value.

## Never on Vercel

- `AGENT_OWNER_PRIVATE_KEY`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `GOATX402_API_SECRET`
- `DATABASE_URL`
- `INGEST_SECRET`

Anything prefixed `NEXT_PUBLIC_` ships inside the JavaScript every visitor
downloads. It is not secret.
