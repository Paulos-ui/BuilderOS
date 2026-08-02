# START HERE — BuilderOS, Step by Step

Every command, in order, from unzipping this folder to having the full stack
running. Nothing is assumed. Each step ends with a **CHECK** you can verify
before moving on — if a check fails, stop there rather than continuing.

Written for macOS and Linux. On Windows, use WSL2 and follow along exactly.

---

## Step 0 — Verify your machine

```bash
node --version
```
Need **v20 or higher**. If not:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
```

```bash
docker --version
docker ps
```
`docker ps` must print a table without error. If it errors, start Docker
Desktop (macOS) or `sudo systemctl start docker` (Linux).

```bash
git --version
```

**CHECK:** all three commands print a version and `docker ps` doesn't error.

---

## Step 1 — Unzip and look around

```bash
unzip builderos.zip
cd builderos
ls
```

You should see:
```
apps/  docs/  packages/  README.md  START_HERE.md
```

```bash
ls apps
# api  console  landing

ls packages
# chain
```

| Folder | What it is | Runs on |
|---|---|---|
| `apps/api` | Backend — auth, profiles, database | :4000 |
| `apps/console` | Product UI — agent rack | :3001 |
| `apps/landing` | Marketing site | :3000 |
| `packages/chain` | GOAT integration — ERC-8004, x402 | library + CLI |

**CHECK:** all four folders exist.

---

# PART A — BACKEND

Do this first. The frontends can run without it, but nothing can log in.

## Step 2 — Install backend dependencies

```bash
cd apps/api
npm install
```

Takes 1–2 minutes. Warnings about vulnerabilities are fine for now.

**CHECK:**
```bash
ls node_modules | wc -l
```
Prints a number in the hundreds.

---

## Step 3 — Start the database

```bash
npm run db:up
```

This starts Postgres (with the pgvector extension) and Redis in Docker.

```bash
docker compose ps
```

**CHECK:** two services listed, Postgres shows `healthy`. If it shows
`starting`, wait 10 seconds and run it again.

---

## Step 4 — Configure environment

```bash
cp .env.example .env
```

Now generate two real secrets:

```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
```

Open `.env` in your editor and replace the two placeholder secret lines with
what those commands printed:

```bash
nano .env      # or: code .env
```

> The API **refuses to boot** without these. That's deliberate — an unset
> JWT signing secret is a security failure, not something to default around.

**CHECK:**
```bash
grep JWT_ACCESS_SECRET .env
```
Shows a long hex string, not `replace-with-...`.

---

## Step 5 — Create the database schema

```bash
npm run prisma:generate
```

> Needs internet — Prisma downloads its engine binaries on first run. Until
> this succeeds, TypeScript will report ~17 errors like `Property 'user' does
> not exist on type 'PrismaService'`. That's expected; they all disappear the
> moment this command completes.

```bash
npm run prisma:migrate -- --name init
```

**CHECK:**
```bash
npx prisma studio
```
Opens <http://localhost:5555> showing your tables: `users`,
`builder_profiles`, `opportunities`, `applications`, `attestations`,
`agent_runs`. Press `Ctrl+C` to close it.

---

## Step 6 — Run the backend

```bash
npm run start:dev
```

**Leave this terminal running.** You should see:
```
BuilderOS Core Platform API listening on :4000
```

Open a **second terminal** for everything below:

```bash
curl http://localhost:4000/healthz
```

**CHECK:** prints `{"status":"ok","service":"builderos-core-platform"}`

---

## Step 7 — Test authentication end to end

Still in the second terminal.

**Request a magic link:**
```bash
curl -X POST http://localhost:4000/v1/auth/email/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"jayking@builderos.dev"}'
```
Prints `{"sent":true}`.

**Now look at the first terminal** (where the API is running). Because no
`RESEND_API_KEY` is set, the link is printed to the console instead of
emailed:
```
[dev] Magic link for jayking@builderos.dev: http://localhost:3000/auth/verify?token=abc-123-...
```

**Copy the token** (everything after `token=`) and verify it:
```bash
curl -X POST http://localhost:4000/v1/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"PASTE_YOUR_TOKEN_HERE"}'
```
Prints `{"accessToken":"eyJhbGci..."}`.

**Use the token:**
```bash
curl http://localhost:4000/v1/profiles/me \
  -H "Authorization: Bearer PASTE_YOUR_ACCESS_TOKEN_HERE"
```

**CHECK:** returns your profile JSON with an `id`, `chains`, `languages`.
You now have a working account.

---

## Step 8 — Run the backend tests

```bash
npm test
npm run lint
```

**CHECK:** tests pass, lint is clean.

---

# PART B — CHAIN SERVICE (GOAT)

## Step 9 — Install and verify

Open a **third terminal**:

```bash
cd builderos/packages/chain
npm install
npm run typecheck
npm test
```

**CHECK:** `14 passed`. These tests need no network and no wallet.

---

## Step 10 — Preview the agent registration documents

**Always dry-run first.** This writes files locally and sends nothing
on-chain:

```bash
npm run register:agent -- --network testnet3 --all --dry-run
```

```bash
cat out/registrations/scout.testnet3.phase1.json
```

You'll see a spec-compliant ERC-8004 registration document. Note
`"registrations": []` — empty on purpose, explained in Step 12.

**CHECK:** two documents exist:
```bash
ls out/registrations/
# forge.testnet3.phase1.json  scout.testnet3.phase1.json
```

> Only Scout and Forge generate. The other four agents are gated behind
> `registerNow: false` in `src/agents/manifests.ts` because their endpoints
> aren't live yet — registering dead endpoints pollutes a public registry.

---

## Step 11 — Get a funded testnet wallet

Create a throwaway key (**never reuse a mainnet key here**):

```bash
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

Derive its address:
```bash
node -e "
const {privateKeyToAccount} = require('viem/accounts');
console.log(privateKeyToAccount('PASTE_YOUR_KEY').address);
"
```

Fund that address with testnet BTC from the GOAT faucet, then confirm it
arrived:

```bash
curl -s -X POST https://rpc.testnet3.goat.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["PASTE_YOUR_ADDRESS","latest"],"id":1}'
```

**CHECK:** the `result` is not `0x0`.

```bash
cp .env.example .env
nano .env      # set AGENT_OWNER_PRIVATE_KEY
```

---

## Step 12 — Register the agents (two phases)

ERC-8004 has a chicken-and-egg problem the spec accepts: the registration
document should contain the `agentId`, but the `agentId` only exists after
you register.

**Phase 1 — publish the document.** Pin
`out/registrations/scout.testnet3.phase1.json` to IPFS, or serve it from
your own domain. Then:

```bash
echo 'AGENT_URI_SCOUT=ipfs://YOUR_HASH_HERE' >> .env
npm run register:agent -- --network testnet3 --agent scout
```

Output:
```
✓ registered — agentId 1042
  tx: https://explorer.testnet3.goat.network/tx/0x...
  phase 2 document: out/registrations/scout.testnet3.phase2.json
```

**Phase 2** — pin the newly written phase-2 file (it now contains the
`agentId`), then call `setAgentURI(1042, <newURI>)`.

Repeat both phases for `forge`.

> The script deliberately **won't pin for you**. A tool that quietly uploads
> your identity documents to whatever gateway happens to be configured is how
> that metadata ends up on infrastructure nobody on your team controls.

**CHECK:** open the explorer link — the transaction shows as successful.

---

# PART C — FRONTEND

## Step 13 — Run the agent console

Open a **fourth terminal**:

```bash
cd builderos/apps/console
npm install
npm run dev -- --port 3001
```

Open <http://localhost:3001>. It redirects to `/console`.

**What to look for:**
- Modules power on top-to-bottom, LEDs flickering before they settle
- `AGENT #1042` — digits roll up like a mechanical counter
- **BuilderScout's ID sits perfectly still** (Bitcoin final)
- **ProofForge's ID drifts very slightly** (sequencer confirmed, still provisional)
- A slow scan line sweeps the rack every few seconds
- Click any module to expand its registry record

That drift-vs-stillness contrast is the whole design idea — settled things
stop moving. See `docs/DESIGN.md`.

**CHECK:** the console renders and modules expand on click.

---

## Step 14 — Run the landing page

Open a **fifth terminal**:

```bash
cd builderos/apps/landing
npm install
npm run dev
```

Open <http://localhost:3000> and scroll slowly through the whole page.

**CHECK:** scrolling drives the animation — the agent constellation section
steps through all six agents as you scroll.

---

## Step 15 — Everything running at once

You should now have five terminals:

| Terminal | Directory | Command |
|---|---|---|
| 1 | `apps/api` | `npm run start:dev` |
| 2 | anywhere | scratch space for `curl` |
| 3 | `packages/chain` | registration commands |
| 4 | `apps/console` | `npm run dev -- --port 3001` |
| 5 | `apps/landing` | `npm run dev` |

- Backend: <http://localhost:4000/healthz>
- Console: <http://localhost:3001>
- Landing: <http://localhost:3000>
- Database browser: `npx prisma studio` → <http://localhost:5555>

---

# PART D — DEPLOY

## Step 16 — Frontends to Vercel

```bash
npm i -g vercel
vercel login
```

```bash
cd builderos/apps/landing
vercel --prod
```

```bash
cd ../console
vercel --prod
```

No configuration needed — Next.js is auto-detected.

---

## Step 17 — Database to Neon

Create a project at <https://neon.tech>, copy the connection string, then
enable pgvector once in their SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Step 18 — Backend to Fly.io

```bash
npm i -g flyctl
fly auth login

cd builderos/apps/api
fly launch --no-deploy
```

```bash
fly secrets set \
  DATABASE_URL="YOUR_NEON_CONNECTION_STRING" \
  JWT_ACCESS_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" \
  JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" \
  APP_BASE_URL="https://your-console.vercel.app"

fly deploy
```

> `APP_BASE_URL` must match your deployed console origin exactly, or CORS
> will reject the browser and the refresh cookie won't be set.

```bash
fly logs
curl https://your-api.fly.dev/healthz
```

**CHECK:** returns `{"status":"ok",...}`

---

# TROUBLESHOOTING

**`Cannot find module '@prisma/client'` / ~17 type errors on `prisma.<model>`**
```bash
cd apps/api && npm run prisma:generate
```

**`prisma generate` fails with 403 or a checksum error**
Your network is blocking Prisma's engine download. Test it:
```bash
curl -sI https://binaries.prisma.sh | head -1
```

**Port already in use**
```bash
lsof -ti:4000 | xargs kill -9    # swap 4000 for 3000 / 3001 as needed
```

**Postgres won't start, or pgvector is missing**
```bash
cd apps/api
docker compose down -v     # WARNING: wipes local data
npm run db:up
```
The `-v` matters — pgvector is enabled by an init script that only runs on a
*fresh* volume.

**Reset the database, keep Docker running**
```bash
npx prisma migrate reset
```

**`next/font` fails during build**
`next/font/google` fetches from `fonts.googleapis.com` at build time. Works
on Vercel and any machine with open internet; fails behind restrictive
firewalls.

**Magic link never appears**
It prints to the **API server's** terminal (terminal 1), not the one you ran
`curl` from.

---

# QUICK REFERENCE

```bash
# Backend
cd apps/api
npm run db:up            # start Postgres + Redis
npm run start:dev        # run API on :4000
npm run prisma:studio    # browse the database
npm test

# Chain
cd packages/chain
npm test
npm run register:agent -- --network testnet3 --all --dry-run

# Frontends
cd apps/console && npm run dev -- --port 3001
cd apps/landing && npm run dev

# Stop the database
cd apps/api && npm run db:down
```
