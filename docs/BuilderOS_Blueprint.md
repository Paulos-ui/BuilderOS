# BuilderOS — Engineering & Product Blueprint
**Prepared for:** Jayking (Paulos-ui) & Co-founding Team
**Status:** v1.0 — Ready for implementation kickoff
**Scope:** Vision → PRD → TDD → Architecture → Roadmap → GTM → Investor narrative

---

## 0. How to use this document

This is a working blueprint, not a pitch artifact. Sections are written so
you can hand any one of them to a specific audience — Section 20 to an
investor, Section 8 to a new backend hire, Section 15 to a designer — without
requiring the rest. Where a decision has real trade-offs, I've stated the
trade-off explicitly instead of hiding it. Where I think a default instinct
would be wrong for a venture-scale product, I've said so directly.

---

## 1. Vision, Mission, Product Strategy

### 1.1 Vision
A world where a builder's track record — not their network, timezone, or
Discord presence — determines what opportunities find them.

### 1.2 Mission
Give every Web3 builder a coordinated system of AI agents that discovers
funding and opportunity, strengthens their applications, automates the
logistics around building, and converts shipped work into portable,
verifiable reputation.

### 1.3 Why now
- **Opportunity fragmentation is a real, measurable tax.** Grant programs,
  hackathons, and bounty boards number in the thousands across ecosystems
  (Gitcoin, Optimism RetroPGF, Base, Superteam, ETHGlobal, GOAT Network
  grants, and hundreds of smaller DAOs). No single directory is
  authoritative or current.
- **Application quality is the actual bottleneck**, not opportunity
  awareness alone. Grant committees reject well-qualified builders for
  poorly-scoped, poorly-written applications constantly. This is a
  solvable, high-leverage problem for an LLM-native product.
- **On-chain reputation is still unsolved.** POAPs and Galxe badges are
  participation trophies, not evidence of *quality* work. A reputation
  system anchored to verified grant completions and reviewed contributions
  is a genuinely different, more defensible asset.
- **Agentic infra (x402, agent-native L2s like GOAT Network) has matured
  enough** that machine-speed settlement between a platform, a builder, and
  a funder is now practical, not theoretical.

### 1.4 Strategic thesis: agents, not an assistant
**Decision:** BuilderOS is architected as a coordinated multi-agent system
with clear service boundaries (BuilderScout, ProofForge, BuilderFlow,
BuilderMatch, BuilderRep, BuilderPay) rather than one general-purpose
chatbot with tools bolted on.

**Why this is the right call, and the trade-off you're accepting:**
A single mega-agent is faster to ship a demo of, and it's tempting because
it avoids inter-service complexity. But it fails at production scale for
three concrete reasons:
1. **Evaluation becomes impossible.** You cannot write a meaningful eval
   suite for "the assistant" — discovery relevance and application-scoring
   accuracy are different quality metrics with different ground truth. Split
   agents get split, testable eval harnesses.
2. **Latency and cost profiles diverge.** Discovery is a background,
   cacheable, batch-friendly workload. Application review is a synchronous,
   user-facing, expensive-per-call workload. Coupling them forces you to
   either over-pay for discovery or degrade review UX.
3. **It doesn't match how you'll actually monetize.** BuilderPay needs
   custody-adjacent rigor that the rest of the system doesn't. Bundling it
   into a general agent means your riskiest code path has the least
   isolation.

**The cost you're accepting:** inter-agent orchestration, a shared context/
memory layer, and more services to deploy and monitor. Section 6 addresses
this directly — this is a real cost, mitigated with a thin orchestration
layer and shared Postgres-backed builder-profile state rather than a
heavyweight service mesh.

### 1.5 Product strategy (phased)
| Phase | Focus | Proof point |
|---|---|---|
| **MVP (0–3 mo)** | BuilderScout + ProofForge only, single-player | A builder finds and ships a stronger application in <30 min, start to finish |
| **V1 (3–7 mo)** | + BuilderFlow, + on-chain BuilderRep (read + attest) | Builders return weekly without being prompted; first 50 verified attestations |
| **V1.5 (7–10 mo)** | + BuilderMatch, + BuilderPay (x402 settlement) | First real dollar/stablecoin value moves through the platform |
| **V2 (10–14 mo)** | Agent marketplace / 3rd-party agent SDK | External teams ship agents on BuilderOS's orchestration layer |

---

## 2. Product Requirements Document (PRD)

### 2.1 Target users
- **Primary:** Independent/small-team Web3 developers actively pursuing
  grants, hackathons, and bounties (the "solo builder" and "2–4 person
  team" personas).
- **Secondary:** Researchers and OSS contributors converting reputation
  into paid work.
- **Tertiary (V1.5+):** Grant programs and DAOs wanting a qualified
  applicant pipeline and less review overhead (this becomes a B2B surface,
  see Section 19).

### 2.2 Jobs to be done
1. "Tell me what I qualify for before the deadline passes, without me
   checking twelve Discords."
2. "Tell me if my application is actually competitive before I submit it."
3. "Stop making me re-explain my project in five different formats."
4. "Give me something durable to show for the work I've already shipped."

### 2.3 MVP functional requirements
**BuilderScout**
- FR1: User connects GitHub + wallet/email → system builds an initial
  builder profile (languages, chains touched, prior grant history if
  public).
- FR2: System returns a ranked opportunity feed within the user's first
  session (cold-start via profile + explicit category/chain filters).
- FR3: User can save, dismiss, and get deadline alerts (email, later push).
- FR4: Every listed opportunity has a source link and last-verified
  timestamp — no unsourced listings.

**ProofForge**
- FR5: User submits a draft (or blank) application against a saved
  opportunity → system returns a 0–100 competitiveness score with
  section-by-section rationale.
- FR6: System generates a first-draft pitch summary, technical brief, and
  budget table from structured project inputs.
- FR7: Every AI-generated claim about the user's project must trace back to
  something the user provided (repo, prior text, structured form) —
  **no fabricated accomplishments.** This is a hard product requirement,
  not a nice-to-have; false claims in a grant application are a real-world
  harm to the user.

### 2.4 Non-functional requirements
- P95 opportunity feed load < 1.5s (served from cache, not live-scraped
  per request).
- P95 ProofForge scoring response < 8s (streamed, not blocking).
- 99.5% uptime target for MVP (not 99.99% — don't over-engineer before
  product-market fit).
- All user-submitted project content encrypted at rest; user can export or
  delete their full profile (GDPR-shaped by default, not bolted on later).

### 2.5 Explicit non-goals for MVP
- No BuilderMatch (collaboration matching) — needs a critical mass of
  profiles to be useful; building it early wastes engineering time on a
  cold-start problem you can't solve yet.
- No BuilderPay settlement — do not touch money movement until BuilderScout
  and ProofForge have retention data proving people come back.
- No mobile app — responsive web only.

---

## 3. Technical Design Document (TDD)

### 3.1 Design principles
1. **Boring technology for the boring 80%.** Postgres, Redis, REST/JSON
   over HTTP. Save novelty budget for the agent orchestration and on-chain
   layers, which are the actual differentiators.
2. **Every agent is a service with a contract**, not a prompt embedded in
   a route handler. Agents are callable independently, testable
   independently, and can be rate-limited/scaled independently.
3. **The builder profile is the single source of truth.** Agents read and
   write to it; they don't maintain private, divergent state about the
   user.
4. **Everything AI-generated is labeled and traceable.** Every scored,
   generated, or ranked artifact stores which model, which prompt version,
   and which inputs produced it. This is both a debugging necessity and a
   trust requirement for a product touching grant applications.

### 3.2 High-level system diagram (textual)
```
                         ┌─────────────────────────┐
                         │      Next.js Web App     │
                         │  (App Router, TS, RSC)    │
                         └────────────┬─────────────┘
                                      │ REST/JSON (+SSE for streaming)
                         ┌────────────▼─────────────┐
                         │        API Gateway        │
                         │  (NestJS) — auth, rate-   │
                         │  limit, request routing   │
                         └───┬───────┬───────┬───────┘
                 ┌───────────┘       │       └───────────┐
        ┌────────▼───────┐  ┌────────▼────────┐  ┌───────▼────────┐
        │ Core Platform   │  │ Agent Orchestr. │  │ Chain Service   │
        │ Service         │  │ Service         │  │ (GOAT/x402)     │
        │ (users, profiles,│  │ (routes to      │  │ (reputation,    │
        │ opportunities,  │  │ agents, memory,  │  │  payments)      │
        │ applications)   │  │  eval logging)   │  │                 │
        └───────┬─────────┘  └───┬────┬────┬────┘  └─────────────────┘
                │                │    │    │
     ┌──────────▼───┐   ┌────────▼┐ ┌─▼──────┐ ┌▼───────────┐
     │  Postgres      │   │Scout   │ │ Forge  │ │ Flow / Rep/│
     │  (primary DB)  │   │ Agent  │ │ Agent  │ │ Match/Pay  │
     └──────────┬─────┘   └───┬────┘ └───┬────┘ │  Agents    │
                │             │          │       └────────────┘
     ┌──────────▼───┐   ┌─────▼──────────▼───┐
     │  Redis         │   │  Vector Store       │
     │  (cache, jobs) │   │  (pgvector)         │
     └────────────────┘   └─────────────────────┘
```

### 3.3 Service boundaries (why these five, specifically)
| Service | Owns | Does NOT own |
|---|---|---|
| **Core Platform** | Users, builder profiles, opportunities catalog, applications, notifications | Any model inference |
| **Agent Orchestration** | Routing a request to the right agent(s), shared conversation/task memory, eval logging, inter-agent handoff contracts | Business data storage (delegates to Core Platform via API) |
| **Agent workers** (Scout/Forge/Flow/Match/Rep) | Their own prompt chains, tool calls, scoring logic | Direct DB writes — they call Core Platform's API, so data validation stays in one place |
| **Chain Service** | Wallet auth verification, GOAT Network reads/writes, x402 payment flows, attestation issuance | UI, business logic about *when* to pay — that's decided upstream and passed in |

This separation is what makes it possible to, e.g., swap ProofForge's model
provider without touching Core Platform, or rate-limit BuilderPay far more
conservatively than BuilderScout, without a monolith deploy risking both.

### 3.4 Why NestJS over FastAPI (the call, and the counter-argument)
**Recommendation: NestJS (TypeScript) for Core Platform + Agent
Orchestration; Python (FastAPI) is used only inside individual agent
workers where it earns its keep (heavier ML/RAG tooling, e.g. if you later
fine-tune retrieval rankers).**

- **For it:** One language across frontend and backend reduces the
  swap-cost for a small team — you and I both move faster in TS across the
  stack. NestJS's dependency-injection and module system maps cleanly onto
  the service-boundary design in 3.3, which matters more than raw framework
  speed at this stage.
- **Against it / the honest trade-off:** Python's AI/ML ecosystem
  (LangChain, LlamaIndex, native SDKs, eval tooling) is genuinely more
  mature than the TS equivalents. This is why agent workers get an
  exception: **Scout and Forge specifically may be implemented as FastAPI
  services** if their RAG/tool-calling complexity outgrows what's
  comfortable in TS — the orchestration contract (Section 6.2) is
  language-agnostic HTTP, so this isn't a lock-in decision.
- **Verdict:** don't force a single language across every service if it
  costs real capability. Force it only where it reduces real friction (the
  web app and the business-logic core).

### 3.5 Why Postgres + Redis (not Mongo, not a vector-only DB)
- Builder profiles, applications, and opportunities are **relational by
  nature** (a builder has many applications, an application references one
  opportunity, opportunities have structured eligibility criteria you'll
  query against). Document stores fight you here at scale.
- **pgvector** gives you RAG retrieval inside the same database as your
  transactional data — one fewer service to run, one fewer place for data
  to drift out of sync, and it's more than fast enough for the actual
  corpus size (thousands to tens of thousands of opportunity documents, not
  billions of vectors). Migrate to a dedicated vector DB (Pinecone/Weaviate)
  only if/when corpus size or query latency actually demands it — don't
  pre-pay that complexity now.
- **Redis** handles session cache, rate-limiting counters, and the job
  queue (BullMQ) for Scout's background crawl/refresh jobs and Forge's
  async scoring jobs.

---

## 4. Database Design

### 4.1 Core schema (PostgreSQL)
```sql
-- Identity & profile
users (
  id UUID PK,
  email TEXT UNIQUE,
  wallet_address TEXT UNIQUE,
  auth_provider TEXT, -- 'email' | 'wallet' | 'both'
  created_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NULL -- soft delete for GDPR export/delete flows
)

builder_profiles (
  id UUID PK,
  user_id UUID FK -> users,
  github_username TEXT,
  chains JSONB,              -- ["base","optimism","goat"]
  languages JSONB,
  bio TEXT,
  embedding VECTOR(1536),    -- pgvector, for opportunity matching
  updated_at TIMESTAMPTZ
)

-- Opportunities (BuilderScout's domain)
opportunities (
  id UUID PK,
  source_url TEXT,
  source_name TEXT,          -- 'gitcoin' | 'superteam' | 'manual' ...
  title TEXT,
  description TEXT,
  category TEXT,             -- 'grant' | 'hackathon' | 'bounty' | 'accelerator'
  chains JSONB,
  funding_min NUMERIC,
  funding_max NUMERIC,
  deadline TIMESTAMPTZ,
  eligibility JSONB,
  embedding VECTOR(1536),
  last_verified_at TIMESTAMPTZ,
  status TEXT                -- 'open' | 'closed' | 'stale'
)

opportunity_matches (
  id UUID PK,
  builder_profile_id UUID FK,
  opportunity_id UUID FK,
  score NUMERIC,             -- Scout's relevance score
  reason JSONB,               -- structured rationale, for trust/debugging
  saved BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  UNIQUE(builder_profile_id, opportunity_id)
)

-- Applications (ProofForge's domain)
applications (
  id UUID PK,
  builder_profile_id UUID FK,
  opportunity_id UUID FK,
  status TEXT,                -- 'draft' | 'scored' | 'submitted' | 'won' | 'rejected'
  content JSONB,               -- structured sections
  score NUMERIC,
  score_breakdown JSONB,
  model_version TEXT,          -- traceability, per 3.1 principle 4
  prompt_version TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Reputation (BuilderRep's domain)
attestations (
  id UUID PK,
  builder_profile_id UUID FK,
  application_id UUID FK NULL,
  type TEXT,                  -- 'grant_completed' | 'contribution_verified'
  chain_tx_hash TEXT,          -- GOAT Network attestation reference
  issued_at TIMESTAMPTZ,
  metadata JSONB
)

-- Payments (BuilderPay's domain — V1.5+)
payments (
  id UUID PK,
  from_ref TEXT,               -- program/DAO identifier
  to_builder_profile_id UUID FK,
  amount NUMERIC,
  currency TEXT,
  x402_payment_id TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)

-- Eval / audit trail (cross-cutting)
agent_runs (
  id UUID PK,
  agent_name TEXT,
  user_id UUID FK NULL,
  input JSONB,
  output JSONB,
  latency_ms INT,
  model TEXT,
  cost_usd NUMERIC,
  created_at TIMESTAMPTZ
)
```

### 4.2 Indexing & caching decisions
- `opportunities`: btree index on `(deadline, status)` for feed queries;
  `ivfflat` index on `embedding` for similarity search.
- `opportunity_matches`: composite unique index doubles as the dedup
  constraint for Scout's re-ranking job.
- Redis caches the **rendered feed per builder profile** (TTL 15 min) —
  not raw opportunity rows — because the ranking computation, not the row
  fetch, is the expensive part.
- `agent_runs` is append-only and gets partitioned by month once volume
  justifies it (not on day one).

---

## 5. Authentication (Wallet + Email)

**Decision:** dual auth, unified identity. A `users` row can have an email,
a wallet, or both — and the two can be linked after the fact.

- **Email:** magic-link (passwordless) via a transactional provider
  (Resend). No password storage, no password-reset attack surface.
- **Wallet:** Sign-In With Ethereum (SIWE)-style challenge: backend issues
  a nonce, wallet signs it, backend verifies signature server-side and
  issues a session. Support injected wallets + WalletConnect via
  **wagmi/viem** on the frontend (matches your default stack).
- **Session:** short-lived JWT (15 min) + rotating refresh token in an
  httpOnly cookie. Do not put session state in localStorage — it's the
  first thing an XSS payload reaches for.
- **Linking flow:** a logged-in email user can add a wallet (and vice
  versa) from account settings; both paths resolve to the same
  `builder_profile`. This matters because forcing a choice at signup loses
  users who aren't sure yet whether they want to expose a wallet publicly.

---

## 6. Multi-Agent AI Architecture

### 6.1 Orchestration model
**Decision: a thin, explicit orchestrator — not a fully autonomous
planner.** The Agent Orchestration Service maintains a small,
hand-written routing table (which agent(s) handle which request types) and
a **task handoff contract**, rather than letting a top-level LLM freely
decide which agents to invoke.

**Why:** Fully autonomous multi-agent planning (an LLM deciding its own
tool/agent call graph) is a real capability, but it's the wrong choice for
a system where a wrong call graph means a user's grant application gets
mishandled. Determinism where it's cheap (routing) buys reliability; save
the LLM's judgment for where only it can do the job (scoring, generation,
matching).

### 6.2 Inter-agent communication contract
Every agent exposes:
```
POST /v1/run
{
  "task_id": "uuid",
  "builder_profile_id": "uuid",
  "input": { ...task-specific... },
  "context": {                 -- shared memory slice, not the whole history
    "builder_summary": "...",  -- compact profile summary, not raw rows
    "prior_agent_outputs": [ ... ]
  }
}
→ 200
{
  "task_id": "uuid",
  "output": { ...task-specific... },
  "confidence": 0.0-1.0,
  "citations": [ ... ],        -- required whenever output makes a factual claim
  "next_suggested_agent": "proofforge" | null
}
```
This contract is deliberately boring HTTP/JSON, not a bespoke RPC protocol
— it's what lets Scout ship in TypeScript and a future Match agent ship in
Python without coordination overhead.

### 6.3 Memory architecture
Three tiers, deliberately not one:
1. **Profile memory (Postgres):** durable facts about the builder — skills,
   chains, history. Read by every agent, written rarely.
2. **Task memory (Redis, TTL'd):** the current session's working context —
   what opportunity is being discussed, what draft is in progress. Cleared
   after task completion.
3. **Episodic/RAG memory (pgvector):** embeddings of the builder's past
   applications and shipped work, retrieved selectively when Forge needs
   evidence for a claim (this is what keeps FR7 — no fabricated
   accomplishments — enforceable: generation is grounded in retrieval, not
   free recall).

### 6.4 RAG pipeline (BuilderScout + ProofForge)
- **Ingestion:** scheduled crawlers (Playwright for JS-heavy sources, RSS/
  API where available) normalize opportunity postings into the
  `opportunities` schema, chunk long descriptions, embed with a
  cost-efficient embedding model, store in pgvector.
- **Retrieval:** hybrid — pgvector similarity **plus** structured filters
  (chain, funding range, deadline window) applied in the same SQL query.
  Pure vector search over-recalls irrelevant-but-semantically-similar
  opportunities (e.g. a Solana hackathon scoring high on a Base builder's
  profile because the *prose* is similar); structured filtering is not
  optional here.
- **Grounding for Forge:** when generating application content, retrieval
  pulls from the builder's own repo READMEs / prior applications, not the
  open web — this is the concrete mechanism behind "no fabricated
  accomplishments."

### 6.5 Tool calling
Agents call typed tools, not arbitrary shell/browser access:
- Scout: `search_opportunities`, `fetch_source_page`, `check_deadline`
- Forge: `score_application`, `generate_section`, `fetch_builder_evidence`
- Rep: `issue_attestation`, `verify_completion`

Every tool call and result is logged to `agent_runs` for evaluation and
debugging — this is your eval dataset, generated as a byproduct of normal
operation rather than built separately later.

### 6.6 Evaluation strategy
- **Scout:** offline relevance eval — a held-out set of (builder profile,
  known-good opportunity) pairs; track recall@10 and precision@5 weekly.
- **Forge:** a rubric-based eval set (real historical grant applications
  with known outcomes where available, or expert-labeled) scored by both
  the model and a human reviewer; track score correlation, not just
  "looks good."
- **All agents:** regression gate in CI — a fixed eval set runs against
  every prompt/model change before merge; a drop below threshold blocks
  deploy. This is non-negotiable for a product where output quality
  directly affects someone's funding outcome.

### 6.7 Model selection
Use a Claude Sonnet-class model as the default reasoning/generation model
for Forge (scoring and generation quality matter most here). A smaller/
cheaper model is appropriate for Scout's ranking/classification work, since
it's higher-volume and lower-stakes per call. Keep model choice
configurable per agent, not hardcoded — you will swap this more than once.

---

## 7. Frontend Architecture (Next.js / TypeScript / Tailwind)

- **Next.js 15+ App Router**, React Server Components for data-heavy pages
  (opportunity feed, profile), client components scoped tightly to
  interactive islands (application editor, scoring UI, wallet connect).
- **State:** Server state via RSC + `fetch` with tags for revalidation;
  client state via lightweight stores (Zustand) only where needed (editor
  drafts, wallet session) — avoid a heavyweight global store for data that
  the server already owns.
- **Styling:** Tailwind, design tokens defined once (the landing page's
  `@theme` pattern in `app/globals.css` is the template for the whole
  product, not just the marketing site).
- **Data fetching:** typed API client generated from the NestJS OpenAPI
  spec (`openapi-typescript`) — no hand-maintained fetch wrappers drifting
  out of sync with the backend.
- **Streaming:** ProofForge's scoring/generation responses stream via SSE
  into the editor UI — this is a UX requirement, not a nicety; an 8-second
  blank loading state on a product about application quality reads as
  broken.

## 8. Folder Structure (Monorepo)

```
builderos/
├── apps/
│   ├── web/                     # Next.js frontend
│   ├── api/                     # NestJS core platform + orchestration
│   └── chain-service/           # GOAT Network / x402 integration service
├── agents/
│   ├── scout/                   # discovery agent worker
│   ├── forge/                   # application review/generation agent
│   ├── flow/                    # automation agent
│   ├── match/                   # collaboration matching agent (V1.5)
│   ├── rep/                     # reputation agent
│   └── pay/                     # payments agent (V1.5)
├── packages/
│   ├── shared-types/            # TS types shared web <-> api <-> agents
│   ├── ui/                      # shared design system components
│   ├── agent-contracts/         # the /v1/run contract, versioned
│   └── config/                  # eslint/tsconfig/tailwind shared config
├── infra/
│   ├── terraform/                # cloud infra as code
│   └── docker/
├── evals/                        # eval datasets + CI eval runner
└── docs/                         # this blueprint, ADRs, runbooks
```
Turborepo for build orchestration/caching across the monorepo — matches the
polyglot-but-connected structure (TS everywhere except optional Python
agent workers).

---

## 9. Blockchain Integration — GOAT Network & x402

### 9.1 Why GOAT Network
GOAT Network's positioning around agent-native, machine-speed transactions
is the actual fit for BuilderOS's payment/reputation needs — bounty and
micro-grant settlement between an agent-mediated platform and a builder
benefits directly from low-latency, low-fee, agent-friendly rails, more
than it would from a general-purpose chain chosen for ecosystem size alone.

### 9.2 x402 payments
- Used for **BuilderPay** settlement: bounty payouts, micro-grant
  disbursement, and (V2) paid agent-to-agent or agent-to-service calls
  (e.g. BuilderScout paying a premium data source per verified lead).
- Integration point: Chain Service exposes `POST /v1/payments/settle`,
  which constructs and submits the x402 payment request; **application
  code never handles private keys** — custody is either non-custodial
  (user's own wallet signs) or delegated to a compliant custody provider
  for program-side disbursements. Do not build custody in-house at this
  stage — that's a regulatory and security surface you don't need to own
  yet.

### 9.3 On-chain reputation
- `attestations` (Section 4.1) mirror to an on-chain attestation registry
  on GOAT Network — each completed grant or verified contribution gets a
  signed, on-chain-anchored record.
- **Design choice:** store the canonical, queryable record in Postgres;
  anchor a hash/reference on-chain. This avoids paying for full on-chain
  storage of application content (expensive, and often you don't want
  application details public) while still making the *fact* of completion
  independently verifiable — the actual property builders want portable.
- Public builder profile page renders these as a verifiable reputation
  timeline (this is your strongest organic growth lever — a builder shares
  their BuilderOS profile the way they'd share a portfolio).

---

## 10. API Specification (representative endpoints)

```
POST   /v1/auth/wallet/challenge
POST   /v1/auth/wallet/verify
POST   /v1/auth/email/magic-link
GET    /v1/profiles/me
PATCH  /v1/profiles/me

GET    /v1/opportunities/feed          # ranked, cached
POST   /v1/opportunities/:id/save
POST   /v1/opportunities/:id/dismiss

POST   /v1/applications                # create draft against an opportunity
POST   /v1/applications/:id/score      # SSE stream
POST   /v1/applications/:id/generate   # SSE stream, section-scoped
PATCH  /v1/applications/:id

GET    /v1/reputation/:profileId       # public attestation timeline
POST   /v1/reputation/attest           # internal, called by Rep agent only

POST   /v1/payments/settle             # internal, called by Pay agent only
GET    /v1/payments/:id
```
Full OpenAPI spec lives in `apps/api` and is the source of truth the
frontend client is generated from — this document gives the shape, not the
final contract.

---

## 11. UI/UX Flows

### 11.1 Core flow: cold start → first application
1. Landing → "Request access" or connect wallet directly.
2. Onboarding: connect GitHub (optional but strongly nudged — it's what
   makes Scout's ranking good on day one), pick chains/interest areas.
3. Feed: ranked opportunities, each card shows score rationale ("matches
   your Solidity + DeFi history"), save/dismiss.
4. Opportunity detail → "Draft with ProofForge" → structured intake form
   (project description, prior work links) → streamed score + generated
   draft sections.
5. Edit inline, re-score on demand, export or copy to the program's actual
   submission portal (BuilderOS doesn't fake being the submission system
   itself in MVP — it prepares you for it).
6. Post-outcome: user marks application won/lost → won applications
   trigger the BuilderRep attestation flow.

### 11.2 Wireframe notes (text-spec, for hi-fi design pass)
- Feed: 2-column on desktop (list + detail panel), single column mobile.
- Score UI: a horizontal breakdown bar (not just one number) — clarity/
  budget realism/technical depth/impact, each independently scored, because
  a single opaque score erodes trust fast.
- Public profile: the reputation timeline is the hero element, not buried —
  it's the shareable artifact.

---

## 12. MVP Scope & Milestones

| Milestone | Deliverable | Target |
|---|---|---|
| M0 | Auth (wallet+email), builder profile, Postgres schema live | Week 2 |
| M1 | Scout: ingestion pipeline for 3 sources + ranked feed UI | Week 6 |
| M2 | Forge: scoring + generation, streamed UI, eval harness passing | Week 10 |
| M3 | Closed beta, 50 real builders, weekly eval review cadence | Week 12 |
| M4 | Public launch, BuilderFlow (deadline/milestone tracking) | Week 16 |

---

## 13. GitHub Repository Structure & Conventions

- Monorepo per Section 8, Turborepo-managed.
- Trunk-based development: short-lived feature branches → PR → main.
  Conventional Commits enforced via commitlint.
- Required CI checks before merge: typecheck, lint, unit tests, eval
  regression gate (Section 6.6) for any PR touching `agents/*` or prompts.
- `docs/adr/` — Architecture Decision Records for every non-obvious call
  (e.g. "why Postgres+pgvector over a dedicated vector DB") — this doc
  seeds the first several ADRs.

## 14. Development Roadmap (MVP → V1)

- **Weeks 1–4:** infra scaffolding, auth, schema, CI/CD skeleton.
- **Weeks 5–10:** Scout + Forge to eval-passing quality, closed alpha with
  ~15 hand-picked builders for direct feedback.
- **Weeks 11–14:** UX hardening from alpha feedback, BuilderFlow v1.
- **Weeks 15–16:** public launch.
- **Months 5–7:** BuilderRep on-chain attestations live; retention data
  gates the go/no-go decision on building BuilderMatch and BuilderPay.

## 15. Testing Strategy
- **Unit:** Jest (TS services), pytest (any Python agent workers).
- **Integration:** contract tests against the `/v1/run` agent interface —
  every agent must pass the same contract test suite regardless of
  implementation language.
- **Eval regression:** Section 6.6 — treated as a test suite, not a
  research artifact; runs in CI.
- **E2E:** Playwright covering the cold-start-to-first-application flow
  end to end, run against a staging environment on every release.

## 16. CI/CD Pipeline
- GitHub Actions: lint/typecheck/unit on every PR; eval regression + E2E on
  merge to main; deploy to staging automatically, production via manual
  approval gate.
- Turborepo remote caching to keep CI fast as the monorepo grows.

## 17. Deployment Architecture
- **Web app:** Vercel (matches your default stack, best-in-class for
  Next.js).
- **API / Agent Orchestration / Chain Service:** containerized (Docker),
  deployed to a managed container platform (Fly.io or AWS ECS/Fargate —
  choose Fly.io for MVP speed, revisit AWS if/when you need deeper
  enterprise compliance posture for B2B grant-program customers).
- **Postgres:** managed (Neon or RDS) with pgvector extension enabled;
  point-in-time recovery on from day one — this is user financial/
  application data, back it up like it matters.
- **Redis:** managed (Upstash) for MVP simplicity.

## 18. Security, Privacy, Scalability
- **Security:** no plaintext secrets in repo (use a secrets manager),
  signed JWTs, rate limiting per user+IP on all public endpoints, wallet
  signature replay protection (nonce expiry).
- **Privacy:** explicit data export/delete endpoints (Section 2.4), no
  training of external models on user data without explicit opt-in,
  application content encrypted at rest.
- **Scalability:** stateless API/agent services behind a load balancer;
  Postgres read replicas once feed-read volume justifies it; the
  cache-the-rendered-feed pattern (Section 4.2) is what actually buys
  headroom before you need to scale the DB itself.

---

## 19. Business Model, Pricing, Go-to-Market

### 19.1 Business model
Two-sided, but monetize the builder side first:
- **Builder tier (B2C):** freemium — free opportunity feed + limited
  ProofForge scores/month; paid tier unlocks unlimited scoring, document
  generation, and priority deadline alerts. This is a real willingness-to-
  pay test: a builder pursuing a $25k grant will pay $20–40/month for a
  meaningfully better shot at winning it.
- **Program tier (B2B, from V1.5):** grant programs/DAOs pay for a
  qualified-applicant pipeline and reduced review overhead — this is where
  the real revenue ceiling is, but it requires the reputation data
  (BuilderRep) to be credible first. Don't pitch this before you have
  attestation volume to back it.

### 19.2 Pricing (initial hypothesis, to be tested)
- Free: 3 ProofForge scores/month, full feed access.
- Builder Pro: ~$29/month — unlimited scoring/generation, deadline alerts,
  public reputation profile.
- Program (B2B): custom, seat + volume based, starting conversations at
  V1.5.

### 19.3 Go-to-market
- **Wedge:** hackathon season. Ship the scroll landing page and a working
  Scout+Forge MVP timed to a major hackathon circuit (ETHGlobal, GOAT
  Network's own grant cycles) — real deadlines create real urgency to try
  the product.
- **Distribution:** the public reputation profile is the growth loop —
  every builder who shares theirs is a top-of-funnel impression for
  BuilderOS, at zero CAC.
- **Credibility:** launch with a small number of named ecosystem partners
  (grant programs willing to be listed as verified sources) rather than
  claiming broad coverage you can't yet back.

---

## 20. Investor Narrative & Pitch Deck Outline

1. **Cold open:** the real cost of opportunity fragmentation — a concrete,
   specific builder story (a real grant missed by days, or a rejected
   application that was fixable).
2. **Market:** size of Web3 grant/hackathon/bounty flow annually, and the
   growth trajectory of agentic infra spend.
3. **Product:** the agent system, demoed live via the scroll landing
   experience and a real BuilderScout→ProofForge flow.
4. **Why now:** x402 + agent-native L2s make the reputation/payment layer
   possible in a way it wasn't 18 months ago.
5. **Traction:** alpha cohort results — applications submitted, score
   deltas (before/after ProofForge), win-rate signal if available.
6. **Business model:** freemium builder tier → B2B program tier expansion.
7. **Moat:** the reputation graph — it compounds and it's not easily
   replicated by a discovery-only competitor.
8. **Team:** why this founding team specifically (your Web3 + shipping
   track record is the credibility anchor here — lead with it).
9. **The ask.**

---

## 21. Engineering Backlog (Prioritized)

**P0 — blocks MVP**
- [ ] Auth service (wallet + email, unified identity)
- [ ] Postgres schema + migrations (Section 4.1)
- [ ] Scout ingestion pipeline (3 initial sources) + ranking job
- [ ] Opportunity feed UI (RSC-based)
- [ ] Forge scoring pipeline + eval harness (Section 6.6) — **build the
      eval harness before scaling prompt iteration**, not after
- [ ] Forge generation (streamed) + application editor UI
- [ ] agent_runs logging (traceability, Section 3.1)

**P1 — needed for public launch**
- [ ] BuilderFlow deadline/milestone tracking + email alerts
- [ ] Public builder profile page
- [ ] BuilderRep attestation issuance (off-chain record first, on-chain
      anchor can follow within the same milestone)
- [ ] Rate limiting + abuse protection on public endpoints

**P2 — V1.5**
- [ ] GOAT Network attestation anchoring (on-chain)
- [ ] x402 payment settlement (BuilderPay)
- [ ] BuilderMatch (only after profile density supports it)

**P3 — V2**
- [ ] Third-party agent SDK / marketplace
- [ ] B2B program dashboard

---

## Closing note

The single highest-leverage sequencing decision in this whole plan: **do
not build BuilderMatch or BuilderPay before Scout and Forge prove
retention.** Everything else here is designed to make that MVP as strong as
possible, as fast as possible, without pre-paying for complexity the
product hasn't earned yet.
