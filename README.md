# BuilderOS

The AI-native operating system for Web3 builders. Discovers grants,
hackathons, and funding opportunities, helps you win them, and turns shipped
work into verifiable reputation — through a coordinated system of specialised
AI agents on GOAT Network.

## 👉 New here? Read [`START_HERE.md`](./START_HERE.md)

Every terminal command, in order, from unzip to deployed.

## What's in this repo

```
builderos/
├── START_HERE.md            ← step-by-step terminal guide
├── apps/
│   ├── api/                 Core Platform — auth, profiles, database (:4000)
│   ├── console/             Product UI — the agent rack (:3001)
│   └── landing/             Marketing site, scroll-driven (:3000)
├── packages/
│   └── chain/               GOAT integration — ERC-8004 + x402
└── docs/
    ├── BuilderOS_Blueprint.md   PRD, TDD, architecture, roadmap, GTM
    ├── DESIGN.md                design tokens + motion system
    └── RUNBOOK.md               operational reference
```

## The 60-second version

```bash
cd apps/api && npm install && npm run db:up
cp .env.example .env          # then set the two JWT secrets
npm run prisma:generate && npm run prisma:migrate -- --name init
npm run start:dev             # :4000

# new terminal
cd apps/console && npm install && npm run dev -- --port 3001
```

## Status

| Piece | State |
|---|---|
| Product & engineering blueprint | ✅ |
| Landing page | ✅ |
| Core API — wallet + email auth, profiles | ✅ |
| Chain service — ERC-8004, x402 | ✅ dry-run verified |
| Agent console + Settlement motion system | ✅ |
| Agent card endpoint (`/.well-known/agent-card.json`) | ⬜ next |
| BuilderScout — ingestion + ranked feed | ⬜ next |
| ProofForge — scoring + generation | ⬜ |

## Stack

Next.js 16 · TypeScript · Tailwind v4 · Framer Motion · Lenis · Three.js ·
NestJS · Prisma · PostgreSQL + pgvector · Redis · viem · GOAT Network

## Design position

We resonate with the GOAT ecosystem rather than imitating it. The motion
system encodes GOAT's **two-speed finality** — sequencer-confirmed values
visibly drift, Bitcoin-final values go completely still. Finality is
signalled by the *removal* of motion, not by adding a badge.

Full rationale in [`docs/DESIGN.md`](./docs/DESIGN.md).
