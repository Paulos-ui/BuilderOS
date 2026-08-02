# BuilderOS — Core Platform API

The identity, profile, and data backbone of BuilderOS. Implements **M0** of
the roadmap in `BuilderOS_Blueprint.md`: wallet + email auth, builder
profiles, and the full Postgres schema every agent reads from.

Built with NestJS + Prisma + PostgreSQL (pgvector) + Redis.

## Quick start

```bash
# 1. Install deps
npm install

# 2. Bring up Postgres (with pgvector) + Redis
npm run db:up

# 3. Configure environment
cp .env.example .env
#    then set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to long random strings:
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Generate the Prisma client and apply the schema
npm run prisma:generate
npm run prisma:migrate -- --name init

# 5. Run
npm run start:dev        # http://localhost:4000
```

Verify it's up: `curl http://localhost:4000/healthz`

> **Note:** step 4 requires internet access — Prisma downloads its query and
> schema engine binaries from `binaries.prisma.sh` on first run. Until
> `prisma generate` completes, TypeScript will report errors on every
> `prisma.<model>` access, because the typed client doesn't exist yet. This
> is expected and resolves entirely once the command runs.

## Architecture

Service boundaries follow Section 3.3 of the blueprint. This repo is the
**Core Platform** service: it owns users, builder profiles, opportunities,
applications, and attestations. It performs **no model inference** — agent
workers call back into this API rather than writing to the database
directly, which keeps all data validation in one place.

```
src/
├── auth/                    # wallet (SIWE) + email magic-link auth
│   ├── auth.controller.ts   # /v1/auth/*
│   ├── auth.service.ts      # challenge/verify, session issuance
│   ├── siwe-message.util.ts # EIP-4361 message build/parse
│   ├── strategies/          # passport JWT strategy
│   ├── guards/              # JwtAuthGuard
│   └── dto/                 # validated request shapes
├── profiles/                # /v1/profiles/*
├── prisma/                  # PrismaService (global module)
├── common/decorators/       # @CurrentUser()
└── main.ts                  # validation pipe, cookies, CORS
```

## Authentication

Two entry paths, **one identity**. A `User` may hold an email, a wallet, or
both, and both resolve to the same `BuilderProfile` — so a builder can start
with email and attach a wallet later without losing their history.

### Wallet (Sign-In With Ethereum)

```
POST /v1/auth/wallet/challenge  { address }             -> { message }
POST /v1/auth/wallet/verify     { message, signature }  -> { accessToken }
```

1. The server mints a single-use nonce bound to the address, stores it with
   a TTL, and returns an EIP-4361 message.
2. The client has the wallet sign that exact string.
3. The server verifies the signature with **viem**, checks the nonce is
   unused and unexpired, then **burns the nonce**. This is what makes a
   captured signature useless on replay.

We build and parse the SIWE message ourselves (`siwe-message.util.ts`)
rather than pulling in the `siwe` package, which requires `ethers` as a peer
dependency — redundant when viem is already in the stack for signature
verification.

### Email (magic link)

```
POST /v1/auth/email/magic-link  { email }  -> { sent: true }
POST /v1/auth/email/verify      { token }  -> { accessToken }
```

Passwordless by design: no password storage, no reset-flow attack surface.
Tokens are single-use and expire in 15 minutes.

In development, if `RESEND_API_KEY` is unset the link is printed to the
server console instead of emailed, so you can exercise the whole flow
without an email account.

### Sessions

- **Access token:** JWT, 15 min, returned in the response body for the
  client to hold in memory.
- **Refresh token:** JWT, 30 days, set as an `httpOnly` cookie scoped to
  `/v1/auth`. Deliberately *not* in `localStorage` — that's the first place
  an XSS payload looks.
- `POST /v1/auth/refresh` rotates the pair on every use, so a stolen refresh
  token has a single-use window rather than 30 days of access.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/healthz` | — | Liveness probe |
| POST | `/v1/auth/wallet/challenge` | — | Request SIWE nonce + message |
| POST | `/v1/auth/wallet/verify` | — | Verify signature, start session |
| POST | `/v1/auth/email/magic-link` | — | Send sign-in link |
| POST | `/v1/auth/email/verify` | — | Verify link token, start session |
| POST | `/v1/auth/refresh` | cookie | Rotate session tokens |
| POST | `/v1/auth/logout` | — | Clear refresh cookie |
| GET | `/v1/profiles/me` | Bearer | Authenticated profile |
| PATCH | `/v1/profiles/me` | Bearer | Update profile |
| GET | `/v1/profiles/:id` | — | Public reputation view |

`GET /v1/profiles/:id` deliberately returns a narrowed projection with no
email or wallet address — it backs the shareable public builder page
described in Section 9.3 of the blueprint.

## Database

Schema lives in `prisma/schema.prisma` and mirrors Section 4.1 of the
blueprint. Notable choices:

- **pgvector in Postgres**, not a separate vector database. `BuilderProfile`
  and `Opportunity` both carry a `vector(1536)` embedding column. At the
  corpus size BuilderOS actually operates on — tens of thousands of
  opportunity documents, not billions of vectors — this is fast enough, and
  keeping vectors alongside transactional data removes an entire class of
  sync bugs. Revisit only if measured query latency demands it.
- Embedding columns use Prisma's `Unsupported("vector(1536)")`, so they're
  managed by migrations but read and written through `$queryRaw` /
  `$executeRaw` when the retrieval layer lands.
- `AgentRun` is an append-only audit log of every agent invocation, capturing
  model, prompt version, latency, and cost. This is both the debugging trail
  and, per Section 6.6, the eval dataset — produced as a byproduct of normal
  operation rather than assembled later.

## Testing

```bash
npm test          # unit
npm run test:e2e  # e2e (needs the database running)
npm run lint
```

`src/auth/siwe-message.util.spec.ts` covers the SIWE message round-trip and
malformed-input handling with no database dependency, so it runs anywhere.

## Security posture

Implements Section 18 of the blueprint:

- Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` — request
  bodies are stripped to the DTO shape, so unexpected fields can't reach a
  service.
- Global rate limiting (`@nestjs/throttler`, 100 req/min) on all endpoints.
- Nonce expiry and single-use enforcement for wallet signature replay
  protection.
- The app refuses to boot if `JWT_ACCESS_SECRET` is unset, rather than
  degrading to an undefined signing key.
- CORS restricted to `APP_BASE_URL` with credentials enabled for the
  refresh cookie.

## What's next

Per the blueprint backlog (Section 21, P0):

- [ ] BuilderScout ingestion pipeline + `/v1/opportunities/feed`
- [ ] ProofForge scoring/generation endpoints with SSE streaming
- [ ] Agent Orchestration service and the `/v1/run` agent contract
- [ ] `AgentRun` logging middleware wired into every agent call
