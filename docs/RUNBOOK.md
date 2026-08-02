# BuilderOS — Terminal Runbook

Everything needed to get all four repos running locally, in order. Copy-paste
safe. Written for macOS/Linux; on Windows use WSL2.

## Prerequisites

```bash
node --version     # need v20+
docker --version   # need Docker Desktop or Engine running
git --version
```

If Node is older than 20, install via [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20 && nvm use 20
```

---

## Repo map

| Repo | What it is | Port |
|---|---|---|
| `builderos-landing` | Public marketing site (scroll-driven) | 3000 |
| `builderos-app` | Product UI — agent console | 3001 |
| `builderos-api` | Core Platform: auth, profiles, DB | 4000 |
| `builderos-chain` | GOAT integration: ERC-8004 + x402 | library |

---

## 1. Core Platform API

This comes first — the app and landing page can run without it, but auth
can't.

```bash
cd builderos-api
npm install

# Start Postgres (with pgvector) + Redis
npm run db:up
docker compose ps          # confirm both are "healthy"

# Configure
cp .env.example .env
```

Generate real secrets and paste them into `.env`:

```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
```

Then create the schema and run:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run start:dev
```

Verify:

```bash
curl http://localhost:4000/healthz
# {"status":"ok","service":"builderos-core-platform"}
```

**Inspect the database visually** (opens on :5555):

```bash
npm run prisma:studio
```

### Exercising auth from the terminal

Email magic link — with no `RESEND_API_KEY` set, the link prints to the
server console instead of sending mail:

```bash
curl -X POST http://localhost:4000/v1/auth/email/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"jayking@builderos.dev"}'
```

Copy the token from the API server's console output, then:

```bash
curl -X POST http://localhost:4000/v1/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"PASTE_TOKEN_HERE"}'
# -> {"accessToken":"eyJ..."}
```

Use that token:

```bash
curl http://localhost:4000/v1/profiles/me \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN"
```

### Tests

```bash
npm test              # unit
npm run test:e2e      # needs the DB running
npm run lint
```

---

## 2. Chain service (ERC-8004 + x402)

```bash
cd builderos-chain
npm install
npm run typecheck
npm test              # 14 tests, no network needed
```

### Registering agents on GOAT

**Always dry-run first.** This writes the registration documents to
`out/registrations/` and sends nothing on-chain:

```bash
npm run register:agent -- --network testnet3 --all --dry-run
cat out/registrations/scout.testnet3.phase1.json
```

Then set up credentials:

```bash
cp .env.example .env
```

You need a funded testnet key in `AGENT_OWNER_PRIVATE_KEY`. Get testnet BTC
for gas from the GOAT faucet, and confirm the balance landed:

```bash
# Replace with your address
curl -s -X POST https://rpc.testnet3.goat.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYOUR_ADDRESS","latest"],"id":1}'
```

**Registration is two-phase** — the document should contain the `agentId`,
but the `agentId` only exists after you register. The spec accepts this.

```bash
# Phase 1: pin out/registrations/scout.testnet3.phase1.json to IPFS
#          (or serve it from builderos.dev), then:
echo 'AGENT_URI_SCOUT=ipfs://QmYourHash' >> .env

npm run register:agent -- --network testnet3 --agent scout
# -> ✓ registered — agentId 1042
#    tx: https://explorer.testnet3.goat.network/tx/0x...
#    phase 2 document: out/registrations/scout.testnet3.phase2.json
```

Phase 2: pin the newly written phase-2 document (it now contains the
`agentId`), then call `setAgentURI(agentId, newURI)`.

Repeat for `forge`. Only Scout and Forge are flagged `registerNow` — the
others are gated in `src/agents/manifests.ts` until their endpoints answer.

**Verify on-chain:**

```bash
open "https://explorer.testnet3.goat.network/tx/YOUR_TX_HASH"
```

---

## 3. Product UI (agent console)

```bash
cd builderos-app
npm install
npm run dev -- --port 3001
```

Open <http://localhost:3001> — redirects to `/console`.

---

## 4. Landing page

```bash
cd builderos-landing
npm install
npm run dev
```

Open <http://localhost:3000>.

---

## Running everything at once

Four terminal tabs:

```bash
# tab 1
cd builderos-api && npm run start:dev

# tab 2
cd builderos-app && npm run dev -- --port 3001

# tab 3
cd builderos-landing && npm run dev

# tab 4 — scratch space for curl / registration
```

---

## Troubleshooting

**`prisma generate` fails with a 403 or checksum error**
Prisma downloads engine binaries from `binaries.prisma.sh` on first run.
Behind a restrictive network this fails. Confirm access:

```bash
curl -sI https://binaries.prisma.sh | head -1
```

**TypeScript errors on every `prisma.<model>` call**
The generated client doesn't exist yet. Run `npm run prisma:generate`.
Roughly 17 errors of the form `Property 'user' does not exist on type
'PrismaService'` all disappear at once.

**`next/font` fails at build time**
`next/font/google` fetches from `fonts.googleapis.com` during the build.
Works on Vercel and any machine with open internet; fails in restricted
sandboxes.

**Port already in use**

```bash
lsof -ti:4000 | xargs kill -9
```

**Postgres won't start / pgvector missing**

```bash
cd builderos-api
docker compose down -v      # ⚠ wipes local data
npm run db:up
```

The `-v` matters: the pgvector extension is enabled by an init script that
only runs on a *fresh* volume.

**Reset the database without touching Docker**

```bash
npx prisma migrate reset
```

---

## Deploying

**Landing + app → Vercel:**

```bash
npm i -g vercel
cd builderos-landing && vercel --prod
cd ../builderos-app && vercel --prod
```

**API → any container host** (Fly.io shown):

```bash
cd builderos-api
fly launch --no-deploy
fly secrets set DATABASE_URL="postgres://..." \
                JWT_ACCESS_SECRET="..." \
                JWT_REFRESH_SECRET="..."
fly deploy
```

Managed Postgres with pgvector: [Neon](https://neon.tech) or Supabase. Enable
the extension once:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Set `APP_BASE_URL` on the API to the deployed app origin, or CORS will
reject the browser and the refresh cookie won't be set.
