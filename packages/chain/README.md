# @builderos/chain

GOAT Network integration for BuilderOS: **ERC-8004 agent identity and
reputation**, plus **x402 payments**.

This package is the Chain Service from Section 3.3 of `BuilderOS_Blueprint.md`.
It owns every on-chain interaction and exposes plain TypeScript to the rest
of the platform, so no other service needs an RPC client or a private key.

## What GOAT actually is (and why it changes our design)

GOAT Network is **Bitcoin-secured infrastructure** — BitVM-based, with
EVM-equivalent execution and BTC as the gas asset. Two consequences we build
around:

1. **Standard Ethereum tooling works unchanged.** viem, Solidity, ABIs — no
   special SDK required. That's why this package is thin.
2. **"Finalized" is stronger and slower than on a typical L2.** Sequencer
   confirmation is the interactive signal; Bitcoin finality is the settlement
   guarantee. Anything user-facing should show the former and reconcile
   against the latter — never block a UI on Bitcoin finality.

## Networks

| | Chain ID | RPC | Identity Registry | Reputation Registry |
|---|---|---|---|---|
| Mainnet | `2345` | `https://rpc.goat.network` | `0x8004A169…a432` | `0x8004BAa1…9b63` |
| Testnet3 | `48816` | `https://rpc.testnet3.goat.network` | `0x55608900…5522` | `0xd9140951…f964` |

Testnet registry addresses are **not** the mainnet ones. `src/config/networks.ts`
is the single source of truth; never hardcode an address at a call site.

## Registering an agent

ERC-8004 has a chicken-and-egg problem the spec simply accepts: the
registration document should contain the `agentId`, but the `agentId` only
exists after you register. So registration is two phases.

```bash
cp .env.example .env

# Phase 0 — generate and inspect documents, nothing on-chain
npm run register:agent -- --network testnet3 --all --dry-run

# Phase 1 — pin the generated document, set AGENT_URI_SCOUT, then register
npm run register:agent -- --network testnet3 --agent scout

# Phase 2 — the script writes an updated document containing the new
# agentId. Pin it, then call setAgentURI(agentId, newURI).
```

The script **never pins anything for you**. That's deliberate: a tool that
quietly uploads agent metadata to whatever gateway happens to be configured
is how your identity documents end up on infrastructure nobody on the team
owns. Pin to IPFS or serve from `builderos.dev` and pass the URI in
explicitly.

### Why six identities, not one

The Reputation Registry accrues feedback **per `agentId`**. Under a single
identity, "BuilderScout found me a great grant" and "ProofForge mis-scored my
draft" would land in the same bucket and neither signal would be actionable.
Separate identities also make discovery work as intended — an external agent
looking for grant discovery should find BuilderScout, not a monolith.

### Why we only register two today

`registerNow` gates which manifests reach the chain. Only **BuilderScout**
and **ProofForge** are flagged, because they're the only agents that can
answer a request. The GOAT docs are explicit that registration is
discoverability rather than automatic trust, and that `x402Support` must
reflect real capability. Registering four agents that resolve to dead
endpoints is registry pollution — and it's a bad look with the ecosystem
team we're asking to fund us. Flip the flag when the endpoint is live.

## x402 payments

**HTTP 402 is the success path, not an error.** A 402 response carries the
payment payload the client needs. Any generic `if (!res.ok) throw` wrapper
placed around this breaks the protocol — `createOrder` handles 402 explicitly
before any status check.

```ts
import { X402Client, x402ConfigFromEnv } from '@builderos/chain';

const x402 = new X402Client(x402ConfigFromEnv());

const order = await x402.createOrder({
  amount: '500',
  currency: 'USD',
  mode: 'DIRECT',            // DELEGATE only when you need callback settlement
  reference: `forge-score:${applicationId}`,
});

// order.paymentPayload -> client signs/pays
const settled = await x402.waitForTerminal(order.orderId);
```

`GOATX402_API_SECRET` is server-side only. It must never reach a frontend
bundle or a `NEXT_PUBLIC_*` variable.

## Agent reputation vs. builder reputation

These are **different problems**, and conflating them would send us down a
wrong path:

- **Agent reputation** — how much a caller should trust BuilderScout. This is
  exactly what ERC-8004's Reputation Registry is for. Use it; don't rebuild it.
- **Builder reputation** — proof that *a human* completed a grant. ERC-8004
  registers *agents*, so registering builders there would misuse the standard.
  This keeps the blueprint's original design: canonical record in Postgres,
  hash anchored on-chain, exposed as a public profile.

Use `giveFeedback` for the first. Keep attestations for the second.

## API

```ts
import {
  IdentityRegistryClient,   // register, setAgentURI, getAgentWallet
  ReputationRegistryClient, // giveFeedback, getSummary, getClients
  X402Client,               // createOrder, getOrder, getProof, waitForTerminal
  buildRegistrationDocument,
  validateRegistrationDocument,
  AGENT_MANIFESTS,
  agentRegistryId,
} from '@builderos/chain';
```

`validateRegistrationDocument` is for documents we *didn't* author — check
foreign agents discovered through the registry before calling them. It flags,
among other things, agents advertising `x402Support` with no payment endpoint.

### Feedback values are integers

There is no on-chain float. A 4.5/5 rating is `value: 45n, valueDecimals: 1`.
Keep the on-chain record compact and put narrative evidence behind
`feedbackURI`, with `feedbackHash` set so a reader can verify it wasn't
altered after the fact.

## Development

```bash
npm run typecheck
npm test          # 14 tests, no network required
npm run build
```

Tests cover document construction, the x402-support invariant, network
identifier derivation, and a guard that we never register an inactive agent.
None of them touch the network.

## Next

- [ ] Wire `X402Client` into ProofForge scoring as metered access
- [ ] Expose `/.well-known/agent-card.json` from the API (A2A endpoint above)
- [ ] `giveFeedback` call after each completed ProofForge run
- [ ] Reputation summary on the public builder profile
